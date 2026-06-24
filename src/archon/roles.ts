import type { Role, Verdict } from "./types.js";
import type { Candidate } from "./types.js";

const EVIDENCE = "Every claim needs evidence (file:line or output); say 'not verified' if unsure. Never log secrets.";

export function parseVerdict(output: string): Verdict {
  const m = output.toUpperCase().match(/\b(ACCEPT|REVISE)\b/g);
  return m && m.length ? (m[m.length - 1] as Verdict) : "REVISE";
}

function listCandidates(cs: Candidate[]): string {
  return cs.map((c, i) => `### Candidate ${i + 1} (id=${c.id}, from ${c.fromProfile})\n${c.text}`).join("\n\n");
}

export function fuserPrompt(task: string, cs: Candidate[]): string {
  return [
    "You are the FUSER. Synthesize ONE best answer from the candidates: keep what is correct, drop what is wrong, reconcile conflicts.",
    EVIDENCE, `\n## Task\n${task}`, `\n## Candidates\n${listCandidates(cs)}`,
  ].join("\n");
}
export function criticPrompt(task: string, cs: Candidate[]): string {
  return [
    "You are the CRITIC. For EACH candidate output a line `id=<id>: strengths=...; weaknesses=...`. Be specific and terse.",
    `\n## Task\n${task}`, `\n## Candidates\n${listCandidates(cs)}`,
  ].join("\n");
}
export function rankerPrompt(task: string, cs: Candidate[], critiques: string): string {
  return [
    "You are the RANKER. Using the critiques, output the candidate ids best-first as a fenced ```json array of ids, e.g. [\"b\",\"a\"].",
    `\n## Task\n${task}`, `\n## Critiques\n${critiques}`, `\n## Candidates\n${listCandidates(cs)}`,
  ].join("\n");
}
export function verifierPrompt(task: string, c: Candidate): string {
  return [
    "You are a VERIFIER. Check the candidate for correctness and completeness against the task.",
    "End with exactly one token on its own line: ACCEPT or REVISE.",
    EVIDENCE, `\n## Task\n${task}`, `\n## Candidate\n${c.text}`,
  ].join("\n");
}
export function unitTestPrompt(task: string): string {
  return [
    "You are the UNIT-TEST GENERATOR. Write thorough unit tests (no solution) for the task below.",
    "Output ONLY a single fenced code block containing runnable tests that import/call the public entry point described in the task.",
    `\n## Task\n${task}`,
  ].join("\n");
}
export function buildRolePrompt(role: Role, task: string, transcript: { role: Role; output: string }[]): string {
  const brief: Record<Role, string> = {
    thinker: "You are the THINKER. Decompose into a plan; do not write the final solution.",
    worker: "You are the WORKER. Execute the plan and produce the concrete solution.",
    verifier: "You are the VERIFIER. Check the latest solution; end with ACCEPT or REVISE.",
  };
  const t = transcript.length ? transcript.map((x) => `### ${x.role}\n${x.output}`).join("\n\n") : "(none)";
  return [brief[role], EVIDENCE, `\n## Task\n${task}`, `\n## Transcript\n${t}`].join("\n");
}
