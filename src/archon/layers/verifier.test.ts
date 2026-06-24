import { describe, it, expect, vi } from "vitest";
import { verifyVote, verifyBest } from "./verifier.js";
import type { EngineDeps } from "../types.js";
import type { SpawnResult } from "../../types.js";

function deps(outs: string[]): EngineDeps {
  const q = [...outs];
  return {
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
    readOutput: () => q.shift() ?? "REVISE",
    outputPathFor: (l) => `/out/${l}`,
  };
}

describe("verifyVote", () => {
  it("accepts on majority ACCEPT, fails closed on tie", async () => {
    const c = { id: "a", text: "A", fromProfile: "x" };
    expect((await verifyVote("t", c, ["v1", "v2", "v3"], deps(["ACCEPT", "ACCEPT", "REVISE"]))).accepted).toBe(true);
    expect((await verifyVote("t", c, ["v1", "v2"], deps(["ACCEPT", "REVISE"]))).accepted).toBe(false);
  });
});

describe("verifyBest", () => {
  it("returns the first candidate passing the vote", async () => {
    const cs = [
      { id: "a", text: "A", fromProfile: "x" },
      { id: "b", text: "B", fromProfile: "y" },
    ];
    // a: REVISE,REVISE (fail) ; b: ACCEPT,ACCEPT (pass) -> returns b
    const best = await verifyBest("t", cs, ["v1", "v2"], deps(["REVISE", "REVISE", "ACCEPT", "ACCEPT"]));
    expect(best.id).toBe("b");
  });
});
