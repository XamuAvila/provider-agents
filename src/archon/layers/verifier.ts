import type { Candidate, EngineDeps, Verdict } from "../types.js";
import { verifierPrompt, parseVerdict } from "../roles.js";

/** Run a panel of verifiers concurrently on one candidate. ACCEPT iff a strict
 *  majority vote ACCEPT (fail-closed on ties — imperfect-verifier mitigation). */
export async function verifyVote(
  task: string,
  c: Candidate,
  verifierProfiles: string[],
  deps: EngineDeps,
): Promise<{ accepted: boolean; votes: Verdict[] }> {
  const votes = await Promise.all(
    verifierProfiles.map(async (vp, i) => {
      const r = await deps.spawn(vp, verifierPrompt(task, c), deps.outputPathFor(`verifier-${c.id}-${i}`));
      return parseVerdict(r.status === "ok" ? deps.readOutput(r.outputPath) : "REVISE");
    }),
  );
  const accept = votes.filter((v) => v === "ACCEPT").length;
  return { accepted: accept * 2 > votes.length, votes };
}

/** Return the first candidate that passes the verifier vote; if none pass,
 *  fall back to the first candidate. */
export async function verifyBest(
  task: string,
  candidates: Candidate[],
  verifierProfiles: string[],
  deps: EngineDeps,
): Promise<Candidate> {
  for (const c of candidates) {
    const { accepted } = await verifyVote(task, c, verifierProfiles, deps);
    if (accepted) return c;
  }
  return candidates[0];
}
