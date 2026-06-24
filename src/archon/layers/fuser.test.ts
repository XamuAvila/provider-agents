import { describe, it, expect, vi } from "vitest";
import { fuse } from "./fuser.js";
import type { EngineDeps } from "../types.js";
import type { SpawnResult } from "../../types.js";

const deps = (out: string): EngineDeps => ({
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
  readOutput: () => out,
  outputPathFor: (l) => `/out/${l}`,
});

describe("fuse", () => {
  it("returns a single fused candidate", async () => {
    const c = await fuse(
      "t",
      [
        { id: "a", text: "A", fromProfile: "x" },
        { id: "b", text: "B", fromProfile: "y" },
      ],
      "aggregator",
      deps("FUSED"),
    );
    expect(c.id).toBe("fused");
    expect(c.text).toBe("FUSED");
    expect(c.fromProfile).toBe("aggregator");
  });
});
