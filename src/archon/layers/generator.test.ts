import { describe, it, expect, vi } from "vitest";
import { generate } from "./generator.js";
import type { EngineDeps } from "../types.js";
import type { SpawnResult } from "../../types.js";

function deps(map: Record<string, string>): EngineDeps {
  return {
    spawn: vi.fn(async (profile: string, _p: string, outputPath: string): Promise<SpawnResult> => ({
      status: "ok", exitCode: 0, outputPath, profile, model: "m", durationMs: 1,
    })),
    readOutput: (p: string) => map[p] ?? "",
    outputPathFor: (label: string) => `/out/${label}`,
  };
}
describe("generate", () => {
  it("produces one candidate per profile×sample, dropping empties", async () => {
    const d = deps({ "/out/a#0": "A0", "/out/b#0": "", "/out/a#1": "A1" });
    const cs = await generate("t", ["a", "b"], 2, d);
    expect(cs.map((c) => c.text).sort()).toEqual(["A0", "A1"]);
    expect(cs.every((c) => c.fromProfile === "a")).toBe(true);
    expect(d.spawn).toHaveBeenCalledTimes(4);
  });
});
