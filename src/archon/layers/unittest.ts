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
      const { ok } = await runner({ [cfg.sol]: extractCode(c.text), [cfg.test]: tests });
      return { ...c, score: ok ? 1 : 0 };
    }),
  );
  return [...scored].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}
