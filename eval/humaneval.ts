import { readFileSync } from "node:fs";
import { runInSandbox } from "../src/archon/sandbox.js";
import { extractCode } from "../src/archon/layers/unittest.js";

/** One HumanEval problem (camelCase view of the official snake_case JSONL). */
export interface HumanEvalProblem {
  taskId: string;
  prompt: string;
  entryPoint: string;
  test: string;
  canonicalSolution: string;
}

export function loadHumanEval(path: string): HumanEvalProblem[] {
  return readFileSync(path, "utf-8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => {
      const r = JSON.parse(l) as Record<string, string>;
      return {
        taskId: r.task_id,
        prompt: r.prompt,
        entryPoint: r.entry_point,
        test: r.test,
        canonicalSolution: r.canonical_solution,
      };
    });
}

export type SandboxRunner = (
  files: Record<string, string>,
  cmd: string[],
  timeoutMs: number,
) => Promise<{ ok: boolean; output: string }>;

/**
 * Build the runnable grading program. The model's solution may be a complete
 * function (signature + body) or just the body to append after the prompt; we
 * detect a `def <entryPoint>` and choose accordingly, then append the hidden
 * canonical test and the `check(entryPoint)` call.
 */
export function assembleProgram(problem: HumanEvalProblem, solution: string): string {
  const code = extractCode(solution);
  const hasDef = new RegExp(`def\\s+${problem.entryPoint}\\b`).test(code);
  const module = hasDef ? code : problem.prompt + code;
  return `${module}\n\n${problem.test}\n\ncheck(${problem.entryPoint})\n`;
}

/** Grade a solution by executing it against the hidden canonical test in the
 *  sandbox. passed iff the program exits 0. */
export async function gradeHumanEval(
  problem: HumanEvalProblem,
  solution: string,
  runner: SandboxRunner = runInSandbox,
): Promise<{ passed: boolean; output: string }> {
  const program = assembleProgram(problem, solution);
  const { ok, output } = await runner({ "prog.py": program }, ["python3", "prog.py"], 10_000);
  return { passed: ok, output: output.slice(0, 2000) };
}

export interface PassAt1 {
  mean: number;
  passed: number;
  n: number;
  perTask: { taskId: string; passed: boolean }[];
}

/** Sequentially solve + grade each problem (sequential to respect upstream rate
 *  limits) and aggregate Pass@1. */
export async function passAt1(
  problems: HumanEvalProblem[],
  solve: (p: HumanEvalProblem) => Promise<string>,
  runner?: SandboxRunner,
): Promise<PassAt1> {
  const perTask: { taskId: string; passed: boolean }[] = [];
  for (const p of problems) {
    const solution = await solve(p);
    const { passed } = await gradeHumanEval(p, solution, runner);
    perTask.push({ taskId: p.taskId, passed });
  }
  const passed = perTask.filter((t) => t.passed).length;
  return { mean: problems.length ? passed / problems.length : 0, passed, n: problems.length, perTask };
}
