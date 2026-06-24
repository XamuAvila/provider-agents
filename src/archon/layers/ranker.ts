import type { Candidate, EngineDeps } from "../types.js";
import { rankerPrompt } from "../roles.js";

/** Parse a fenced ```json array of candidate ids (best-first), keeping only
 *  ids present in `validIds`. Returns [] on any parse failure. */
export function parseIdRanking(raw: string, validIds: string[]): string[] {
  const m = raw.match(/```json\s*([\s\S]*?)```/);
  try {
    const arr = JSON.parse(m ? m[1] : raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.map(String).filter((id) => validIds.includes(id));
  } catch {
    return [];
  }
}

/** Reorder candidates best-first using the ranker's parsed id list, then take
 *  top-K. Unranked candidates keep their input order after the ranked ones;
 *  on parse failure the input order is preserved. */
export async function rank(
  task: string,
  candidates: Candidate[],
  rankerProfile: string,
  topK: number,
  deps: EngineDeps,
): Promise<Candidate[]> {
  if (candidates.length <= 1) return candidates.slice(0, topK);
  const critiques = candidates.map((c) => c.critique ?? "").join("\n");
  const r = await deps.spawn(rankerProfile, rankerPrompt(task, candidates, critiques), deps.outputPathFor("ranker"));
  const raw = r.status === "ok" ? deps.readOutput(r.outputPath) : "";
  const order = parseIdRanking(raw, candidates.map((c) => c.id));
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const ranked = order.map((id) => byId.get(id)).filter((c): c is Candidate => c !== undefined);
  const rest = candidates.filter((c) => !order.includes(c.id));
  return [...ranked, ...rest].slice(0, topK);
}
