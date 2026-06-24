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

export const EMPTY_POLICY: Policy = {
  version: 0,
  rules: [],
  notes: "",
  updatedAt: "1970-01-01T00:00:00.000Z",
};
