import { describe, it, expect, vi } from "vitest";
import { DEFAULT_POOLS, makeEngineDeps, runArchon } from "./runtime.js";
import type { EngineDeps } from "./types.js";
import type { SpawnResult } from "../types.js";

describe("makeEngineDeps", () => {
  it("uses cross-family generators and verifiers by default", () => {
    expect(DEFAULT_POOLS.generators).toEqual(["deepseek", "kimi-code"]);
    expect(DEFAULT_POOLS.verifiers).toEqual(["deepseek", "kimi-code"]);
  });
  it("outputPathFor returns unique, sanitized paths", () => {
    const deps = makeEngineDeps({ outputDir: "/tmp/archon-test-out" });
    const a = deps.outputPathFor("g1#0");
    const b = deps.outputPathFor("g1#0");
    expect(a).not.toBe(b); // counter makes each call unique
    expect(a).not.toContain("#"); // label sanitized for the filesystem
  });
});

function mockDeps(): EngineDeps {
  let c = 0;
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
    readOutput: (path: string) =>
      path.includes("fused") ? "FUSED" : path.includes("ranker") || path.includes("critic") ? "" : "GEN",
    outputPathFor: (l) => `/out/${c++}-${l}`,
  };
}

describe("runArchon", () => {
  it("routes a general task to the general spec and returns the fused answer", async () => {
    const r = await runArchon("Summarize the meeting notes", { deps: mockDeps() });
    expect(r.spec.name).toBe("general");
    expect(r.answer).toBe("FUSED");
    expect(r.traceId).toContain("general");
  });

  it("routes a python code task to the code spec", async () => {
    // code spec ends in unittest; we only assert routing here (don't run assemble's
    // real sandbox) by checking deriveTags->spec via a stubbed deps that returns no
    // candidates so the pipeline short-circuits before unittest executes anything.
    const empty: EngineDeps = {
      spawn: vi.fn(
        async (p: string, _pr: string, outputPath: string): Promise<SpawnResult> => ({
          status: "error",
          exitCode: 1,
          outputPath,
          profile: p,
          model: "m",
          durationMs: 1,
        }),
      ),
      readOutput: () => "",
      outputPathFor: (l) => `/out/${l}`,
    };
    const r = await runArchon("def add(a, b):\n    return a + b", { deps: empty });
    expect(r.spec.name).toBe("code");
    expect(r.spec.layers.map((l) => l.kind)).toContain("unittest");
    expect(r.answer).toBe(""); // all generators errored -> empty, no execution
  });
});
