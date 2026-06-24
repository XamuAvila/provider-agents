import { describe, it, expect, vi } from "vitest";
import { extractCode, unitTestRank } from "./unittest.js";
import type { EngineDeps } from "../types.js";
import type { SpawnResult } from "../../types.js";

describe("unittest layer", () => {
  it("extractCode returns the last fenced block", () => {
    expect(extractCode("```py\nx=1\n```\n```py\nprint(2)\n```")).toBe("print(2)");
  });

  it("ranks candidates by injected runner pass/fail", async () => {
    const deps: EngineDeps = {
      spawn: vi.fn(
        async (p: string, _x: string, outputPath: string): Promise<SpawnResult> => ({
          status: "ok",
          exitCode: 0,
          outputPath,
          profile: p,
          model: "m",
          durationMs: 1,
        }),
      ),
      readOutput: () => "```python\n# tests\n```",
      outputPathFor: (l) => `/out/${l}`,
    };
    const runner = vi.fn(async (_f: Record<string, string>) => ({ ok: false, output: "" }));
    runner.mockResolvedValueOnce({ ok: true, output: "" }); // first candidate passes
    const cs = [
      { id: "a", text: "```python\ncodeA\n```", fromProfile: "x" },
      { id: "b", text: "```python\ncodeB\n```", fromProfile: "y" },
    ];
    const ranked = await unitTestRank("t", cs, "tester", "python", deps, runner);
    expect(ranked[0].id).toBe("a");
    expect(ranked[0].score).toBe(1);
    expect(ranked[1].score).toBe(0);
  });

  it("ranks by PASSED-TEST COUNT from pytest summary, not binary all-or-nothing", async () => {
    const deps: EngineDeps = {
      spawn: vi.fn(
        async (p: string, _x: string, outputPath: string): Promise<SpawnResult> => ({
          status: "ok",
          exitCode: 0,
          outputPath,
          profile: p,
          model: "m",
          durationMs: 1,
        }),
      ),
      readOutput: () => "```python\n# tests\n```",
      outputPathFor: (l) => `/out/${l}`,
    };
    // "a" passes 2/3 generated tests; "b" passes 3/3. The OLD binary scorer would give
    // a=0 (exit!=0) and b=1, but two near-correct candidates that both fail one flaky
    // assertion would tie at 0 and keep input order. Count-based scoring must rank by
    // how many tests passed: b(3) above a(2).
    const runner = vi.fn(async (_f: Record<string, string>) => ({ ok: false, output: "" }));
    runner.mockResolvedValueOnce({ ok: false, output: "1 failed, 2 passed in 0.04s" }); // a -> 2
    runner.mockResolvedValueOnce({ ok: true, output: "3 passed in 0.03s" }); // b -> 3
    const cs = [
      { id: "a", text: "```python\ncodeA\n```", fromProfile: "x" },
      { id: "b", text: "```python\ncodeB\n```", fromProfile: "y" },
    ];
    const ranked = await unitTestRank("t", cs, "tester", "python", deps, runner);
    expect(ranked[0].id).toBe("b");
    expect(ranked[0].score).toBe(3);
    expect(ranked[1].id).toBe("a");
    expect(ranked[1].score).toBe(2);
  });
});
