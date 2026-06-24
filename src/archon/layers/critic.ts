import type { Candidate, EngineDeps } from "../types.js";
import { criticPrompt } from "../roles.js";

/** Annotate each candidate with a one-line critique (strengths/weaknesses)
 *  produced by a single critic spawn. Candidates with no matching line pass
 *  through unchanged. */
export async function critique(
  task: string,
  candidates: Candidate[],
  criticProfile: string,
  deps: EngineDeps,
): Promise<Candidate[]> {
  if (candidates.length === 0) return candidates;
  const r = await deps.spawn(criticProfile, criticPrompt(task, candidates), deps.outputPathFor("critic"));
  const text = r.status === "ok" ? deps.readOutput(r.outputPath) : "";
  return candidates.map((c) => {
    const line = text.split("\n").find((l) => l.includes(`id=${c.id}`));
    return line ? { ...c, critique: line.trim() } : c;
  });
}
