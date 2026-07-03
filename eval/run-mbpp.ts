import { join } from "node:path";
import { loadMbpp, gradeMbpp, type MbppProblem } from "./mbpp.js";
import { makeEngineDeps, runArchon } from "../src/archon/runtime.js";
import { hasNetIsolation } from "../src/archon/sandbox.js";
import type { Pools } from "../src/archon/assemble.js";
import { resolveVaultDir } from "../src/archon/memory.js";
import { evalFailureToLearning, writeLearning, upsertLearningIndex } from "../src/archon/learnings.js";

/**
 * Live benchmark #2: single-agent baseline vs the Archon ensemble + execution-
 * grounded selection on an MBPP subset. Same shape as run-eval.ts (HumanEval),
 * but on a DIFFERENT famous benchmark (Mostly Basic Python Problems) so a win
 * here is not HumanEval-specific overfitting.
 *
 * MBPP quirk: the function name/signature is NOT in the NL `text` — it lives in
 * the asserts. So both baseline and archon get `text` + the visible `test_list`;
 * grading runs ALL asserts (visible + held-out challenge) via gradeMbpp. The
 * pipeline still selects among its candidates with its OWN generated tests; it
 * never sees the grader.
 *
 * Tunables via env: EVAL_N, EVAL_BASELINE, EVAL_SUBSET, EVAL_GENERATORS, EVAL_TESTER.
 */
const SUBSET = join(process.cwd(), process.env.EVAL_SUBSET ?? "eval/tasks/mbpp-systematic.jsonl");
const N = Number(process.env.EVAL_N ?? 12);
const BASELINE = process.env.EVAL_BASELINE ?? "gen-gptoss";
// All-FREE, fast ensemble (same rationale as run-eval.ts: no DeepThink on the
// critical path). deepseek stays the production anchor for fuser/critic/ranker.
const POOLS: Pools = {
  generators: (process.env.EVAL_GENERATORS ?? "gen-gptoss,gen-nemotron-super,gen-gemma,gen-laguna").split(","),
  fuser: "deepseek",
  critic: "deepseek",
  ranker: "deepseek",
  verifiers: ["gen-gptoss", "gen-nemotron-super", "gen-gemma"],
  tester: process.env.EVAL_TESTER ?? "gen-gptoss",
};

/** MBPP solve prompt: NL text + the VISIBLE asserts (the only place the function
 *  name/signature appears). Ask for ONE complete fenced function, no prose. */
function solvePrompt(p: MbppProblem): string {
  return (
    "Write a Python function for the task below. Output ONLY one fenced python " +
    "code block containing the COMPLETE function (plus any imports), no explanation.\n\n" +
    p.text +
    "\n\nYour function MUST pass these tests (they define the exact name and signature):\n" +
    p.testList.join("\n")
  );
}

async function main(): Promise<void> {
  const deps = makeEngineDeps();
  const all = loadMbpp(SUBSET);
  const problems = all.slice(0, N);
  console.log(
    `MBPP: ${problems.length}/${all.length} problems (N=${N}, a SUBSET). ` +
      `baseline=${BASELINE} | archon pool=[${POOLS.generators.join(", ")}] | netIsolation=${hasNetIsolation()}`,
  );

  // Same Obsidian-learnings wiring as HumanEval: every regression / capability-gap
  // / recovery becomes a durable note any future model reads before acting.
  const LEARN = process.env.EVAL_LEARNINGS !== "0";
  const vaultDir = resolveVaultDir();
  let learningsWritten = 0;

  const baselineSolve = async (p: MbppProblem): Promise<string> => {
    const out = deps.outputPathFor(`baseline-${p.taskId.replace(/\W/g, "_")}`);
    const r = await deps.spawn(BASELINE, solvePrompt(p), out);
    return r.status === "ok" ? deps.readOutput(r.outputPath) : "";
  };
  const archonSolve = async (p: MbppProblem): Promise<string> => {
    const { answer } = await runArchon(solvePrompt(p), { deps, pools: POOLS, lang: "python" });
    return answer;
  };

  let basePass = 0;
  let archonPass = 0;
  for (let i = 0; i < problems.length; i++) {
    const p = problems[i];
    let b = false;
    let a = false;
    try {
      b = (await gradeMbpp(p, await baselineSolve(p))).passed;
    } catch (e) {
      console.error(`  baseline error on ${p.taskId}:`, e);
    }
    try {
      a = (await gradeMbpp(p, await archonSolve(p))).passed;
    } catch (e) {
      console.error(`  archon error on ${p.taskId}:`, e);
    }
    if (b) basePass++;
    if (a) archonPass++;
    console.log(
      `[${i + 1}/${problems.length}] ${p.taskId}: baseline=${b ? "PASS" : "fail"} archon=${a ? "PASS" : "fail"} ` +
        `(running: base ${basePass}, archon ${archonPass})`,
    );
    if (LEARN && !(a && b)) {
      const learning = evalFailureToLearning({
        source: "mbpp",
        problemId: p.taskId,
        prompt: p.text,
        baselinePassed: b,
        archonPassed: a,
        createdAt: new Date().toISOString(),
      });
      try {
        writeLearning(learning, vaultDir);
        upsertLearningIndex(learning, vaultDir);
        learningsWritten++;
        console.log(`        ↳ Obsidian learning: ${learning.id} [${learning.severity}]`);
      } catch (e) {
        console.error(`  learning write failed for ${p.taskId}:`, e);
      }
    }
  }

  const n = problems.length;
  const ok = archonPass >= basePass && archonPass > 0;
  console.log(`\n=== RESULT (n=${n}) ===`);
  console.log(`baseline (${BASELINE}) Pass@1: ${basePass}/${n} = ${(basePass / n).toFixed(3)}`);
  console.log(`archon (ensemble)     Pass@1: ${archonPass}/${n} = ${(archonPass / n).toFixed(3)}`);
  console.log(`delta: ${archonPass - basePass}  =>  ${ok ? "SUCCESS (archon >= baseline AND archon > 0)" : "NOT MET"}`);
  if (LEARN) console.log(`learnings → ${join(vaultDir, "Learnings")} (${learningsWritten} written/updated this run)`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
