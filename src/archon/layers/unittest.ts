import type { Candidate, EngineDeps } from "../types.js";
import { unitTestPrompt } from "../roles.js";
import { runInSandbox } from "../sandbox.js";

/** Return the body of the last fenced code block, or the trimmed text if none. */
export function extractCode(text: string): string {
  const blocks = [...text.matchAll(/```[a-zA-Z0-9]*\n([\s\S]*?)```/g)];
  return blocks.length ? blocks[blocks.length - 1][1].trim() : text.trim();
}

const RUN: Record<string, { test: string; sol: string; cmd: string[] }> = {
  python: { test: "test_main.py", sol: "solution.py", cmd: ["python3", "-m", "pytest", "-q", "test_main.py"] },
};

export type Runner = (files: Record<string, string>) => Promise<{ ok: boolean; output: string }>;

/**
 * Score a candidate by HOW MANY generated tests it passed, parsed from the pytest
 * summary ("N passed", optionally "M failed, N passed"). Granular pass-count beats
 * binary all-or-nothing: a single flaky/wrong assertion no longer zeroes out an
 * otherwise-correct candidate, so the best-of-N selection survives imperfect
 * self-generated tests (the Archon failure mode that lost HumanEval/10). Falls back
 * to ok?1:0 when no summary is present (e.g. import error, "no tests ran").
 */
export function passedCount(output: string, ok: boolean): number {
  const m = output.match(/(\d+)\s+passed/);
  return m ? Number(m[1]) : ok ? 1 : 0;
}

/**
 * Execution-grounded ranking (Archon's biggest code lever): generate unit tests
 * once, then run each candidate's code against them in the sandbox; score
 * pass(1)/fail(0) and return candidates sorted by score desc. `runner` is
 * injected so unit tests never execute real code.
 */
export async function unitTestRank(
  task: string,
  candidates: Candidate[],
  testGenProfile: string,
  lang: string,
  deps: EngineDeps,
  runner: Runner = (f) => runInSandbox(f, RUN[lang].cmd, 20000),
): Promise<Candidate[]> {
  const cfg = RUN[lang];
  if (!cfg || candidates.length === 0) return candidates;
  const tg = await deps.spawn(testGenProfile, unitTestPrompt(task), deps.outputPathFor("unittest-gen"));
  const tests = extractCode(tg.status === "ok" ? deps.readOutput(tg.outputPath) : "");
  const scored = await Promise.all(
    candidates.map(async (c) => {
      const { ok, output } = await runner({ [cfg.sol]: extractCode(c.text), [cfg.test]: tests });
      return { ...c, score: passedCount(output, ok) };
    }),
  );
  // Stable sort by pass-count desc: ties keep input (pool) order, so the strongest
  // generator listed first acts as the anchor when execution can't discriminate.
  return [...scored].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}
