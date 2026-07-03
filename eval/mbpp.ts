import { readFileSync } from "node:fs";
import { runInSandbox } from "../src/archon/sandbox.js";
import { extractCode } from "../src/archon/layers/unittest.js";
import type { SandboxRunner } from "./humaneval.js";

/**
 * One MBPP problem (camelCase view of the official snake_case JSONL).
 *
 * MBPP differs from HumanEval in three ways the harness must respect:
 *  - `task_id` is an INTEGER; we normalize it to a stable "MBPP/<n>" id so the
 *    learnings problemKey (`split("/").pop()`) keeps working across benchmarks.
 *  - the NL `text` does NOT state the function name/signature — it lives only in
 *    the asserts, so `test_list` MUST be shown to the model (see run-mbpp.ts).
 *  - a solution is a COMPLETE function; there is no prompt prefix to prepend.
 */
export interface MbppProblem {
  /** normalized "MBPP/<n>" */
  taskId: string;
  /** natural-language task description (shown to the model) */
  text: string;
  /** assert strings — shown to the model AND used for grading */
  testList: string[];
  /** extra held-out asserts (often empty) — graded but NOT shown */
  challengeTestList: string[];
  /** scaffolding (imports/classes) the asserts rely on; runs before them */
  testSetupCode: string;
  /** reference solution — NEVER shown to the model, kept for inspection */
  code: string;
}

export function loadMbpp(path: string): MbppProblem[] {
  return readFileSync(path, "utf-8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => {
      const r = JSON.parse(l) as Record<string, unknown>;
      const taskId = typeof r.task_id === "number" ? `MBPP/${r.task_id}` : String(r.task_id);
      return {
        taskId,
        text: String(r.text ?? ""),
        testList: Array.isArray(r.test_list) ? (r.test_list as string[]) : [],
        challengeTestList: Array.isArray(r.challenge_test_list) ? (r.challenge_test_list as string[]) : [],
        testSetupCode: String(r.test_setup_code ?? ""),
        code: String(r.code ?? ""),
      };
    });
}

/** Every assert used for grading: the shown `test_list` plus the held-out
 *  `challenge_test_list`. Grading on the held-out asserts too makes the metric
 *  honest — a candidate cannot pass by hardcoding only the visible cases. */
export function gradingAsserts(problem: MbppProblem): string[] {
  return [...problem.testList, ...problem.challengeTestList];
}

/**
 * Build the runnable grading program: test scaffolding first (it may define
 * imports/classes the asserts need), then the candidate's COMPLETE function,
 * then every assert. Unlike HumanEval there is no signature prompt to prepend —
 * MBPP solutions are whole functions — so we never duplicate a `def`.
 */
export function assembleProgramMbpp(problem: MbppProblem, solution: string): string {
  const code = extractCode(solution);
  const setup = problem.testSetupCode.trim();
  const asserts = gradingAsserts(problem).join("\n");
  return [setup, code, asserts].filter((s) => s.trim()).join("\n\n") + "\n";
}

/** Grade a solution by executing it against the asserts in the sandbox.
 *  passed iff the program exits 0 (no AssertionError, no exception). */
export async function gradeMbpp(
  problem: MbppProblem,
  solution: string,
  runner: SandboxRunner = runInSandbox,
): Promise<{ passed: boolean; output: string }> {
  const program = assembleProgramMbpp(problem, solution);
  const { ok, output } = await runner({ "prog.py": program }, ["python3", "prog.py"], 10_000);
  return { passed: ok, output: output.slice(0, 2000) };
}

export interface PassAt1Mbpp {
  mean: number;
  passed: number;
  n: number;
  perTask: { taskId: string; passed: boolean }[];
}

/** Sequentially solve + grade each problem (sequential to respect upstream rate
 *  limits) and aggregate Pass@1. */
export async function passAt1Mbpp(
  problems: MbppProblem[],
  solve: (p: MbppProblem) => Promise<string>,
  runner?: SandboxRunner,
): Promise<PassAt1Mbpp> {
  const perTask: { taskId: string; passed: boolean }[] = [];
  for (const p of problems) {
    const solution = await solve(p);
    const { passed } = await gradeMbpp(p, solution, runner);
    perTask.push({ taskId: p.taskId, passed });
  }
  const passed = perTask.filter((t) => t.passed).length;
  return { mean: problems.length ? passed / problems.length : 0, passed, n: problems.length, perTask };
}
