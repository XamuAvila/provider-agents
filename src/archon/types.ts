export const ROLES = ["thinker", "worker", "verifier"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export type Verdict = "ACCEPT" | "REVISE";

export interface Turn {
  index: number;
  role: Role;
  profile: string;
  model: string;
  instruction: string;
  outputPath: string;
  output: string;
  verdict?: Verdict;
  status: "ok" | "error" | "timeout";
  durationMs: number;
}

export interface CoordinationRequest {
  task: string;
  /** candidate profile names the coordinator may route to */
  pool: string[];
  /** hard cap on turns (TRINITY uses 5) */
  maxTurns?: number;
  /** working directory passed to spawned agents */
  cwd?: string;
  /** when true, the worker step runs as a Mixture-of-Agents fan-out */
  moa?: boolean;
}

export interface CoordinationResult {
  answer: string;
  turns: Turn[];
  accepted: boolean;
  traceId: string;
}

export interface PolicyRule {
  /** lowercased substring/tag matched against the task text */
  when: string;
  forRole: Role;
  preferProfile: string;
  rationale: string;
}

export interface Policy {
  version: number;
  rules: PolicyRule[];
  notes: string;
  updatedAt: string;
}

export interface Trace {
  id: string;
  task: string;
  taskTags: string[];
  turns: Turn[];
  accepted: boolean;
  score?: number;
  createdAt: string;
}

export interface Candidate {
  id: string;
  text: string;
  fromProfile: string;
  score?: number;
  critique?: string;
}

/**
 * A durable lesson distilled from an eval failure, persisted to the Obsidian
 * vault so ANY future agent/model reads it before acting (institutional memory).
 * Mirrors the user's memory convention: a one-line `description` for recall, a
 * `lesson` (the takeaway) and `howToApply` (the actionable rule). `severity`
 * lets a reader triage; `source`/`problemId` trace it back to the eval run.
 */
export interface Learning {
  /** kebab-case slug; also the note filename */
  id: string;
  title: string;
  /** one-line summary used for recall/relevance */
  description: string;
  tags: string[];
  severity: "critical" | "high" | "medium" | "low";
  /** eval/benchmark that produced it, e.g. "humaneval" */
  source: string;
  /** specific case, e.g. "HumanEval/10" (optional for synthesized lessons) */
  problemId?: string;
  /** what was observed to go wrong */
  whatHappened: string;
  /** the diagnosed underlying cause */
  rootCause: string;
  /** the generalizable takeaway */
  lesson: string;
  /** the concrete rule a future model should follow */
  howToApply: string;
  createdAt: string;
}

export type LayerKind = "generator" | "fuser" | "critic" | "ranker" | "verifier" | "unittest";
export interface LayerConfig { kind: LayerKind; profiles?: string[]; samples?: number; topK?: number; }
export interface ArchitectureSpec { name: string; layers: LayerConfig[]; }
export interface EngineDeps {
  spawn: (profile: string, prompt: string, outputPath: string, cwd?: string) => Promise<import("../types.js").SpawnResult>;
  readOutput: (path: string) => string;
  outputPathFor: (label: string) => string;
}

export const EMPTY_POLICY: Policy = {
  version: 0,
  rules: [],
  notes: "",
  updatedAt: "1970-01-01T00:00:00.000Z",
};
