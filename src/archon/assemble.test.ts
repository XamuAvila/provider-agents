import { describe, it, expect, vi } from "vitest";
import { bestPracticeSpec, assemble, type Pools } from "./assemble.js";
import type { EngineDeps } from "./types.js";
import type { SpawnResult } from "../types.js";

describe("bestPracticeSpec", () => {
  it("code tasks select by execution (unittest, no fuser)", () => {
    const k = bestPracticeSpec(["python", "code"]).layers.map((l) => l.kind);
    expect(k).toContain("unittest");
    expect(k).not.toContain("fuser");
  });
  it("reasoning tasks include a verifier layer", () => {
    expect(bestPracticeSpec(["reasoning"]).layers.map((l) => l.kind)).toContain("verifier");
  });
  it("general tasks use ranker+fuser, no unittest", () => {
    const k = bestPracticeSpec(["general"]).layers.map((l) => l.kind);
    expect(k).toContain("ranker");
    expect(k).not.toContain("unittest");
  });
});

function deps(map: Record<string, string>): EngineDeps {
  return {
    spawn: vi.fn(
      async (p: string, _pr: string, outputPath: string): Promise<SpawnResult> => ({
        status: "ok",
        exitCode: 0,
        outputPath,
        profile: p,
        model: "m",
        durationMs: 1,
      }),
    ),
    readOutput: (path: string) => map[path] ?? "",
    outputPathFor: (l) => `/out/${l}`,
  };
}

const pools: Pools = {
  generators: ["g1"],
  fuser: "f",
  critic: "c",
  ranker: "r",
  verifiers: ["v"],
  tester: "t",
};

describe("assemble (general path, DI'd spawn)", () => {
  it("threads generator -> critic -> ranker -> fuser and returns the fused answer", async () => {
    const map = {
      "/out/g1#0": "G1",
      "/out/critic": "id=g1#0: strengths=ok; weaknesses=none",
      "/out/ranker": '```json\n["g1#0"]\n```',
      "/out/fused": "FUSED",
    };
    const { answer, candidates } = await assemble("task", ["general"], bestPracticeSpec(["general"]), deps(map), pools);
    expect(answer).toBe("FUSED");
    expect(candidates).toHaveLength(1);
    expect(candidates[0].id).toBe("fused");
  });
});
