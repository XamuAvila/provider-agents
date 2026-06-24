import { describe, it, expect, vi } from "vitest";
import { critique } from "./critic.js";
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

describe("critique", () => {
  it("annotates each candidate from its id= line", async () => {
    const out = "id=a: strengths=clear; weaknesses=none\nid=b: strengths=fast; weaknesses=unsafe";
    const cs = await critique(
      "t",
      [
        { id: "a", text: "A", fromProfile: "x" },
        { id: "b", text: "B", fromProfile: "y" },
      ],
      "critic",
      deps(out),
    );
    expect(cs[0].critique).toContain("strengths=clear");
    expect(cs[1].critique).toContain("weaknesses=unsafe");
  });

  it("returns input unchanged when there are no candidates", async () => {
    expect(await critique("t", [], "critic", deps(""))).toEqual([]);
  });
});
