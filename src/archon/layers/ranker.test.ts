import { describe, it, expect, vi } from "vitest";
import { rank, parseIdRanking } from "./ranker.js";
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

describe("parseIdRanking", () => {
  it("parses a fenced json id array, keeping only valid ids", () => {
    expect(parseIdRanking('```json\n["b","z","a"]\n```', ["a", "b"])).toEqual(["b", "a"]);
    expect(parseIdRanking("garbage", ["a", "b"])).toEqual([]);
  });
});

describe("rank", () => {
  it("reorders by parsed ranking and applies topK", async () => {
    const cs = [
      { id: "a", text: "A", fromProfile: "x" },
      { id: "b", text: "B", fromProfile: "y" },
      { id: "c", text: "C", fromProfile: "z" },
    ];
    const ranked = await rank("t", cs, "ranker", 2, deps('```json\n["c","a","b"]\n```'));
    expect(ranked.map((c) => c.id)).toEqual(["c", "a"]);
  });

  it("falls back to input order (topK) when parse fails", async () => {
    const cs = [
      { id: "a", text: "A", fromProfile: "x" },
      { id: "b", text: "B", fromProfile: "y" },
    ];
    const ranked = await rank("t", cs, "ranker", 2, deps("garbage"));
    expect(ranked.map((c) => c.id)).toEqual(["a", "b"]);
  });
});
