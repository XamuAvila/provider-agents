import type { Candidate, EngineDeps } from "../types.js";
import { fuserPrompt } from "../roles.js";

/** Mixture-of-Agents synthesis: one spawn that fuses all candidates into a
 *  single best answer. Returns one Candidate with id="fused". */
export async function fuse(
  task: string,
  candidates: Candidate[],
  fuserProfile: string,
  deps: EngineDeps,
): Promise<Candidate> {
  const outputPath = deps.outputPathFor("fused");
  const r = await deps.spawn(fuserProfile, fuserPrompt(task, candidates), outputPath);
  const text = r.status === "ok" ? deps.readOutput(r.outputPath).trim() : "";
  return { id: "fused", text, fromProfile: fuserProfile };
}
