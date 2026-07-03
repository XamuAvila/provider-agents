import { describe, it, expect } from "vitest";
import { join } from "node:path";
import {
  loadMbpp,
  gradingAsserts,
  assembleProgramMbpp,
  gradeMbpp,
  passAt1Mbpp,
  type MbppProblem,
} from "./mbpp.js";

const SUBSET = join(process.cwd(), "eval/tasks/mbpp-subset.jsonl");

describe("loadMbpp", () => {
  it("maps snake_case fields to camelCase and normalizes the integer task_id", () => {
    const ps = loadMbpp(SUBSET);
    expect(ps.length).toBeGreaterThanOrEqual(6);
    // MBPP task_id is an integer; normalize to a stable "MBPP/<n>" string so the
    // learnings problemKey (split("/").pop()) keeps working across benchmarks.
    expect(ps[0].taskId).toBe("MBPP/11");
    expect(ps[0].text).toContain("remove first and last occurrence");
    expect(Array.isArray(ps[0].testList)).toBe(true);
    expect(ps[0].testList[0]).toContain("assert remove_Occ");
  });
});

const fakeProblem: MbppProblem = {
  taskId: "MBPP/1",
  text: "Write a function add that returns the sum of two numbers.",
  testList: ["assert add(1, 2) == 3", "assert add(0, 0) == 0"],
  challengeTestList: ["assert add(-1, 1) == 0"],
  testSetupCode: "",
  code: "def add(a, b): return a + b",
};

describe("gradingAsserts", () => {
  it("concatenates the shown test_list with the held-out challenge asserts", () => {
    expect(gradingAsserts(fakeProblem)).toEqual([
      "assert add(1, 2) == 3",
      "assert add(0, 0) == 0",
      "assert add(-1, 1) == 0",
    ]);
  });
});

describe("assembleProgramMbpp", () => {
  it("emits candidate code then every assert, with no prompt prefix", () => {
    const prog = assembleProgramMbpp(fakeProblem, "def add(a, b):\n    return a + b");
    expect(prog).toContain("def add(a, b):");
    expect(prog).toContain("assert add(1, 2) == 3");
    expect(prog).toContain("assert add(-1, 1) == 0"); // challenge assert included
    // exactly one definition — the candidate's, not a duplicated signature
    expect(prog.match(/def add\(/g)?.length).toBe(1);
  });
  it("extracts code from a fenced block and prepends the test_setup_code", () => {
    const withSetup = { ...fakeProblem, testSetupCode: "import math" };
    const prog = assembleProgramMbpp(withSetup, "```python\ndef add(a, b):\n    return a + b\n```");
    expect(prog.indexOf("import math")).toBeLessThan(prog.indexOf("def add("));
    expect(prog).not.toContain("```");
  });
});

describe("gradeMbpp (stub runner)", () => {
  it("passed=true when the sandbox exits ok", async () => {
    const r = await gradeMbpp(fakeProblem, "x", async () => ({ ok: true, output: "" }));
    expect(r.passed).toBe(true);
  });
  it("passed=false when the sandbox fails", async () => {
    const r = await gradeMbpp(fakeProblem, "x", async () => ({ ok: false, output: "AssertionError" }));
    expect(r.passed).toBe(false);
  });
});

describe("passAt1Mbpp (stub)", () => {
  it("aggregates the pass rate in task order", async () => {
    const probs = [fakeProblem, { ...fakeProblem, taskId: "MBPP/2" }];
    let i = 0;
    const r = await passAt1Mbpp(
      probs,
      async () => "sol",
      async () => ({ ok: i++ === 0, output: "" }),
    );
    expect(r.n).toBe(2);
    expect(r.passed).toBe(1);
    expect(r.mean).toBe(0.5);
    expect(r.perTask.map((t) => t.taskId)).toEqual(["MBPP/1", "MBPP/2"]);
  });
});
