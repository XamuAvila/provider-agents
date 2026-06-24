import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { loadHumanEval, assembleProgram, gradeHumanEval, passAt1, type HumanEvalProblem } from "./humaneval.js";

const SUBSET = join(process.cwd(), "eval/tasks/humaneval-subset.jsonl");

describe("loadHumanEval", () => {
  it("maps snake_case fields to camelCase from the vendored subset", () => {
    const ps = loadHumanEval(SUBSET);
    expect(ps.length).toBeGreaterThanOrEqual(20);
    expect(ps[0].taskId).toBe("HumanEval/0");
    expect(ps[0].entryPoint).toBeTruthy();
    expect(ps[0].test).toContain("def check");
  });
});

const fakeProblem: HumanEvalProblem = {
  taskId: "T/1",
  prompt: "def add(a, b):\n    ",
  entryPoint: "add",
  test: "def check(candidate):\n    assert candidate(1, 2) == 3",
  canonicalSolution: "return a + b",
};

describe("assembleProgram", () => {
  it("prepends the prompt for a body-only solution", () => {
    const prog = assembleProgram(fakeProblem, "    return a + b");
    expect(prog).toContain("def add(a, b):");
    expect(prog).toContain("check(add)");
  });
  it("does not duplicate the signature for a full-function solution", () => {
    const prog = assembleProgram(fakeProblem, "```python\ndef add(a, b):\n    return a + b\n```");
    expect(prog.match(/def add\(/g)?.length).toBe(1);
  });
});

describe("gradeHumanEval (stub runner)", () => {
  it("passed=true when the sandbox exits ok", async () => {
    const r = await gradeHumanEval(fakeProblem, "x", async () => ({ ok: true, output: "" }));
    expect(r.passed).toBe(true);
  });
  it("passed=false when the sandbox fails", async () => {
    const r = await gradeHumanEval(fakeProblem, "x", async () => ({ ok: false, output: "boom" }));
    expect(r.passed).toBe(false);
  });
});

describe("passAt1 (stub)", () => {
  it("aggregates the pass rate in task order", async () => {
    const probs = [fakeProblem, { ...fakeProblem, taskId: "T/2" }];
    let i = 0;
    const r = await passAt1(
      probs,
      async () => "sol",
      async () => ({ ok: i++ === 0, output: "" }),
    );
    expect(r.n).toBe(2);
    expect(r.passed).toBe(1);
    expect(r.mean).toBe(0.5);
    expect(r.perTask.map((t) => t.taskId)).toEqual(["T/1", "T/2"]);
  });
});
