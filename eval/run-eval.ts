import { join } from "node:path";
import { loadHumanEval, gradeHumanEval, type HumanEvalProblem } from "./humaneval.js";
import { makeEngineDeps, runArchon } from "../src/archon/runtime.js";
import { hasNetIsolation } from "../src/archon/sandbox.js";
import type { Pools } from "../src/archon/assemble.js";

/**
 * Live benchmark: single-agent baseline vs the Archon ensemble + execution-
 * grounded selection on a HumanEval subset. The pipeline NEVER sees the hidden
 * canonical test — it selects among candidates via its own generated tests;
 * gradeHumanEval runs the chosen completion against the hidden test.
 *
 * Tunables via env: EVAL_N (#problems), EVAL_BASELINE (profile).
 */
const SUBSET = join(process.cwd(), "eval/tasks/humaneval-subset.jsonl");
const N = Number(process.env.EVAL_N ?? 8);
const BASELINE = process.env.EVAL_BASELINE ?? "gen-gptoss";
const POOLS: Pools = {
  generators: ["deepseek", "gen-gptoss", "gen-nemotron-super", "gen-gemma"],
  fuser: "deepseek",
  critic: "deepseek",
  ranker: "deepseek",
  verifiers: ["deepseek", "gen-gptoss", "gen-nemotron-super"],
  tester: "deepseek",
};

function solvePrompt(p: HumanEvalProblem): string {
  return (
    "Complete this Python function. Output ONLY one fenced python code block " +
    "containing the COMPLETE function (signature + body), no explanation.\n\n" +
    p.prompt
  );
}

async function main(): Promise<void> {
  const deps = makeEngineDeps();
  const all = loadHumanEval(SUBSET);
  const problems = all.slice(0, N);
  console.log(
    `HumanEval: ${problems.length}/${all.length} problems (N=${N}, a SUBSET). ` +
      `baseline=${BASELINE} | archon pool=[${POOLS.generators.join(", ")}] | netIsolation=${hasNetIsolation()}`,
  );

  const baselineSolve = async (p: HumanEvalProblem): Promise<string> => {
    const out = deps.outputPathFor(`baseline-${p.taskId.replace(/\W/g, "_")}`);
    const r = await deps.spawn(BASELINE, solvePrompt(p), out);
    return r.status === "ok" ? deps.readOutput(r.outputPath) : "";
  };
  const archonSolve = async (p: HumanEvalProblem): Promise<string> => {
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
      b = (await gradeHumanEval(p, await baselineSolve(p))).passed;
    } catch (e) {
      console.error(`  baseline error on ${p.taskId}:`, e);
    }
    try {
      a = (await gradeHumanEval(p, await archonSolve(p))).passed;
    } catch (e) {
      console.error(`  archon error on ${p.taskId}:`, e);
    }
    if (b) basePass++;
    if (a) archonPass++;
    console.log(
      `[${i + 1}/${problems.length}] ${p.taskId}: baseline=${b ? "PASS" : "fail"} archon=${a ? "PASS" : "fail"} ` +
        `(running: base ${basePass}, archon ${archonPass})`,
    );
  }

  const n = problems.length;
  const ok = archonPass >= basePass && archonPass > 0;
  console.log(`\n=== RESULT (n=${n}) ===`);
  console.log(`baseline (${BASELINE}) Pass@1: ${basePass}/${n} = ${(basePass / n).toFixed(3)}`);
  console.log(`archon (ensemble)     Pass@1: ${archonPass}/${n} = ${(archonPass / n).toFixed(3)}`);
  console.log(`delta: ${archonPass - basePass}  =>  ${ok ? "SUCCESS (archon >= baseline AND archon > 0)" : "NOT MET"}`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
