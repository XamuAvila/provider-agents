# Coordinator (Sakana-style) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a learned-by-reflection coordination layer to the `provider-agents` package that orchestrates heterogeneous LLMs (Thinker/Worker/Verifier roles + Mixture-of-Agents), persists every run as a trace in the Obsidian vault, and evolves a routing/instruction policy from those traces — reaching parity with or beating Sakana's TRINITY/Conductor on our task distribution and on public benchmarks.

**Architecture:** A new `src/coordinator/` module inside the existing TS MCP package. It reuses `spawnAgent`/`loadMergedConfig` to run each turn as a real provider-agent process, reads each agent's file output back into a transcript, and runs a bounded Thinker→Worker→Verifier loop with optional MoA fan-out. Every run writes a markdown trace note to the Obsidian vault; a `reflect_policy` step reads recent traces and asks a strong `reflector` agent to evolve a human-readable `policy.md`. The next run loads that policy to bias role/model/instruction selection. This is the local, weight-free analog of TRINITY's evolutionary coordinator and Conductor's RL coordinator: the policy is **text in Obsidian**, evolved by reflection, not weights trained by gradient.

**Tech Stack:** TypeScript (ESM, `type: module`), Node ≥18, `@modelcontextprotocol/server`, `js-yaml`, `zod`, Vitest, tsup. Memory layer = plain markdown files in the Obsidian vault (no MCP dependency for the happy path). Optional semantic search via the `mcp-tools-istefox` Obsidian MCP (opt-in, gated on a running server + bearer token).

## Global Constraints

- Package root: `/home/samuel/Documentos/pessoal/provider-agents` — all `src/**` paths are relative to it.
- Profiles file (shared, symlinked to `~/.config/provider-agents/profiles.yaml`): `/home/samuel/Documentos/blis/repos/deepclaude/.claude/profiles.yaml`.
- Vault root (configurable via `PROVIDER_AGENTS_VAULT` env): default `/home/samuel/Documentos/Obsidian Vault`.
- ESM imports MUST use the `.js` extension on relative paths (e.g. `import { x } from "./types.js"`) — matches existing `src/*.ts`.
- Immutability: never mutate inputs; return new objects (matches repo style, e.g. `config.ts:108`).
- Only `claude-p` profiles accept `mcp_config`; `cli` profiles get the vault via `--add-dir` or prompt injection — never pass `mcp_config` to a `cli` profile.
- Never print, echo, or log secrets, API keys, or bearer tokens — redact. The Obsidian MCP bearer token comes from env, never hardcoded.
- All new agent-facing prompts keep the repo's evidence rules ("every claim needs file:line or command output; say 'not verified' otherwise").
- Tests use Vitest with dependency-injected spawn/IO — NO real agent processes spawned in unit tests.
- Run `npm run typecheck` and `npm test` green before every commit.

---

## File Structure

New module `src/coordinator/` (each file one responsibility):

- `src/coordinator/types.ts` — Role, Turn, Trace, Policy, request/result types.
- `src/coordinator/roles.ts` — role prompt templates + verifier verdict parsing.
- `src/coordinator/memory.ts` — vault path resolution, trace/policy read+write (markdown + frontmatter).
- `src/coordinator/policy.ts` — apply a Policy to pick the profile for a (role, task).
- `src/coordinator/coordinate.ts` — the Thinker→Worker→Verifier loop with recursion (DI for spawn/IO).
- `src/coordinator/moa.ts` — Mixture-of-Agents fan-out + aggregation.
- `src/coordinator/reflect.ts` — read recent traces → spawn reflector → write evolved policy.
- `src/coordinator/index.ts` — barrel re-export for the module.
- `src/coordinator/*.test.ts` — Vitest unit tests, colocated.

Modified:
- `src/index.ts` — register two MCP tools: `coordinate`, `reflect_policy`.

Config / profiles (in the `deepclaude` repo, not the package):
- `/home/samuel/Documentos/blis/repos/deepclaude/.claude/obsidian.mcp.json` — MCP server entry for the Obsidian connector (opt-in).
- `profiles.yaml` — add `thinker`, `worker`, `verifier`, `aggregator`, `reflector` profiles.

Eval harness:
- `eval/tasks/ours.jsonl` — our real tasks (code-review / RCA) with ground truth.
- `eval/run-eval.ts` — runs a baseline (single best agent) vs the coordinator, scores via judge, emits a report.
- `eval/judge.ts` — LLM-judge metric (DI-tested).

> **Scope note:** This plan delivers the **reflexivo coordinator** end-to-end (M0–M4): engine + memory + KB wiring + reflection + eval (our tasks + public-benchmark adapter). The **GEPA/DSPy programmatic optimizer** (the "depois" tier) is a **separate sequel plan** — it is a different stack (Python) and depends on the trace corpus this plan generates. See "Sequel" at the end.

---

## Milestone M0 — Module scaffolding & types

### Task 1: Coordinator types

**Files:**
- Create: `src/coordinator/types.ts`
- Test: `src/coordinator/types.test.ts`

**Interfaces:**
- Consumes: nothing (leaf module).
- Produces: `Role`, `Turn`, `Trace`, `Policy`, `PolicyRule`, `CoordinationRequest`, `CoordinationResult` — used by every other coordinator file.

- [ ] **Step 1: Write the failing test**

```ts
// src/coordinator/types.test.ts
import { describe, it, expect } from "vitest";
import { ROLES, isRole } from "./types.js";

describe("coordinator types", () => {
  it("ROLES lists the three Sakana-style roles in order", () => {
    expect(ROLES).toEqual(["thinker", "worker", "verifier"]);
  });

  it("isRole narrows valid role strings", () => {
    expect(isRole("thinker")).toBe(true);
    expect(isRole("verifier")).toBe(true);
    expect(isRole("aggregator")).toBe(false);
    expect(isRole("")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/coordinator/types.test.ts`
Expected: FAIL — `Cannot find module './types.js'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/coordinator/types.ts
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

export const EMPTY_POLICY: Policy = {
  version: 0,
  rules: [],
  notes: "",
  updatedAt: "1970-01-01T00:00:00.000Z",
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/coordinator/types.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/coordinator/types.ts src/coordinator/types.test.ts
git commit -m "feat(coordinator): role and trace/policy types"
```

---

### Task 2: Role prompts & verdict parsing

**Files:**
- Create: `src/coordinator/roles.ts`
- Test: `src/coordinator/roles.test.ts`

**Interfaces:**
- Consumes: `Role`, `Verdict`, `Turn` from `./types.js`.
- Produces:
  - `buildRolePrompt(role: Role, task: string, transcript: Turn[]): string`
  - `parseVerdict(output: string): Verdict`

- [ ] **Step 1: Write the failing test**

```ts
// src/coordinator/roles.test.ts
import { describe, it, expect } from "vitest";
import { buildRolePrompt, parseVerdict } from "./roles.js";
import type { Turn } from "./types.js";

const turn = (over: Partial<Turn>): Turn => ({
  index: 0, role: "thinker", profile: "analyst", model: "m",
  instruction: "", outputPath: "", output: "", status: "ok", durationMs: 1, ...over,
});

describe("roles", () => {
  it("thinker prompt asks for decomposition and includes the task", () => {
    const p = buildRolePrompt("thinker", "fix the race in db.ts", []);
    expect(p).toContain("fix the race in db.ts");
    expect(p.toLowerCase()).toContain("decompose");
  });

  it("worker prompt embeds prior transcript outputs", () => {
    const p = buildRolePrompt("worker", "task", [turn({ output: "PRIOR_PLAN" })]);
    expect(p).toContain("PRIOR_PLAN");
  });

  it("verifier prompt demands ACCEPT or REVISE", () => {
    const p = buildRolePrompt("verifier", "task", []);
    expect(p).toContain("ACCEPT");
    expect(p).toContain("REVISE");
  });

  it("parseVerdict reads the last verdict token, defaulting to REVISE", () => {
    expect(parseVerdict("looks good. ACCEPT")).toBe("ACCEPT");
    expect(parseVerdict("needs work REVISE please")).toBe("REVISE");
    expect(parseVerdict("no verdict here")).toBe("REVISE");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/coordinator/roles.test.ts`
Expected: FAIL — `Cannot find module './roles.js'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/coordinator/roles.ts
import type { Role, Turn, Verdict } from "./types.js";

const ROLE_BRIEF: Record<Role, string> = {
  thinker:
    "You are the THINKER. Decompose the task into a concrete plan: sub-steps, " +
    "key risks, and what a correct solution must satisfy. Do NOT write the final " +
    "solution — produce the strategy the worker will execute.",
  worker:
    "You are the WORKER. Execute the plan and produce the concrete solution " +
    "(code, derivation, answer). Follow the transcript; do the actual work.",
  verifier:
    "You are the VERIFIER. Check the latest solution against the task for " +
    "correctness and completeness. End your reply with exactly one token on its " +
    "own: ACCEPT if it is correct and complete, or REVISE if it needs another pass. " +
    "When REVISE, state the single most important defect first.",
};

const EVIDENCE_RULE =
  "Every claim about code/behavior needs evidence (file:line or command output); " +
  "say 'not verified' when you cannot prove it. Never print or log secrets.";

function renderTranscript(transcript: Turn[]): string {
  if (transcript.length === 0) return "(no prior turns)";
  return transcript
    .map((t) => `### Turn ${t.index} — ${t.role} (${t.profile})\n${t.output}`)
    .join("\n\n");
}

export function buildRolePrompt(
  role: Role,
  task: string,
  transcript: Turn[],
): string {
  return [
    ROLE_BRIEF[role],
    EVIDENCE_RULE,
    `\n## Task\n${task}`,
    `\n## Transcript so far\n${renderTranscript(transcript)}`,
  ].join("\n");
}

export function parseVerdict(output: string): Verdict {
  // last explicit token wins; default REVISE (fail-closed, like TRINITY's loop)
  const matches = output.toUpperCase().match(/\b(ACCEPT|REVISE)\b/g);
  if (!matches || matches.length === 0) return "REVISE";
  return matches[matches.length - 1] as Verdict;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/coordinator/roles.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/coordinator/roles.ts src/coordinator/roles.test.ts
git commit -m "feat(coordinator): role prompts and verdict parsing"
```

---

## Milestone M1 — The Thinker/Worker/Verifier loop

### Task 3: Policy application (route a role to a profile)

**Files:**
- Create: `src/coordinator/policy.ts`
- Test: `src/coordinator/policy.test.ts`

**Interfaces:**
- Consumes: `Policy`, `Role`, `PolicyRule` from `./types.js`.
- Produces: `selectProfile(role: Role, task: string, pool: string[], policy: Policy, fallback: Record<Role, string>): string`

- [ ] **Step 1: Write the failing test**

```ts
// src/coordinator/policy.test.ts
import { describe, it, expect } from "vitest";
import { selectProfile, DEFAULT_FALLBACK } from "./policy.js";
import type { Policy } from "./types.js";

const policy = (over: Partial<Policy> = {}): Policy => ({
  version: 1, rules: [], notes: "", updatedAt: "2026-01-01T00:00:00.000Z", ...over,
});

describe("selectProfile", () => {
  it("uses a matching policy rule when its profile is in the pool", () => {
    const p = policy({
      rules: [{ when: "typescript", forRole: "worker", preferProfile: "coder", rationale: "x" }],
    });
    expect(selectProfile("worker", "fix a TypeScript bug", ["coder", "deepseek"], p, DEFAULT_FALLBACK))
      .toBe("coder");
  });

  it("ignores a rule whose profile is not in the pool", () => {
    const p = policy({
      rules: [{ when: "typescript", forRole: "worker", preferProfile: "ghost", rationale: "x" }],
    });
    expect(selectProfile("worker", "typescript task", ["deepseek"], p, DEFAULT_FALLBACK))
      .toBe("deepseek"); // fallback worker, intersected with pool
  });

  it("falls back to the role default filtered by the pool", () => {
    expect(selectProfile("thinker", "anything", ["analyst", "coder"], policy(), DEFAULT_FALLBACK))
      .toBe("analyst");
  });

  it("falls back to the first pool member when no default is available", () => {
    expect(selectProfile("verifier", "anything", ["weirdo"], policy(), DEFAULT_FALLBACK))
      .toBe("weirdo");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/coordinator/policy.test.ts`
Expected: FAIL — `Cannot find module './policy.js'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/coordinator/policy.ts
import type { Policy, Role } from "./types.js";

/** Role → preferred profile when the policy has no opinion. */
export const DEFAULT_FALLBACK: Record<Role, string> = {
  thinker: "analyst",
  worker: "coder",
  verifier: "reviewer",
};

export function selectProfile(
  role: Role,
  task: string,
  pool: string[],
  policy: Policy,
  fallback: Record<Role, string>,
): string {
  const taskLc = task.toLowerCase();

  const rule = policy.rules.find(
    (r) =>
      r.forRole === role &&
      taskLc.includes(r.when.toLowerCase()) &&
      pool.includes(r.preferProfile),
  );
  if (rule) return rule.preferProfile;

  const def = fallback[role];
  if (pool.includes(def)) return def;

  return pool[0];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/coordinator/policy.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/coordinator/policy.ts src/coordinator/policy.test.ts
git commit -m "feat(coordinator): policy-driven role-to-profile routing"
```

---

### Task 4: The coordination loop

**Files:**
- Create: `src/coordinator/coordinate.ts`
- Test: `src/coordinator/coordinate.test.ts`

**Interfaces:**
- Consumes: `buildRolePrompt`, `parseVerdict` (`./roles.js`); `selectProfile`, `DEFAULT_FALLBACK` (`./policy.js`); types (`./types.js`); `SpawnResult` (`../types.js`).
- Produces:
  - `CoordinatorDeps` interface: `{ spawn, readOutput, outputPathFor, policy, now }`
  - `coordinate(req: CoordinationRequest, deps: CoordinatorDeps): Promise<CoordinationResult>`
  - The loop order is Thinker (turn 0) → Worker → Verifier, repeating Worker→Verifier on REVISE up to `maxTurns`.

- [ ] **Step 1: Write the failing test**

```ts
// src/coordinator/coordinate.test.ts
import { describe, it, expect, vi } from "vitest";
import { coordinate, type CoordinatorDeps } from "./coordinate.js";
import { EMPTY_POLICY } from "./types.js";
import type { SpawnResult } from "../types.js";

function makeDeps(outputs: string[]): CoordinatorDeps {
  const queue = [...outputs];
  const spawn = vi.fn(
    async (profile: string): Promise<SpawnResult> => ({
      status: "ok", exitCode: 0, outputPath: `/out/${profile}`,
      profile, model: "m", durationMs: 1,
    }),
  );
  const readOutput = vi.fn((_path: string) => queue.shift() ?? "");
  return {
    spawn,
    readOutput,
    outputPathFor: (p) => `/out/${p}`,
    policy: EMPTY_POLICY,
    now: () => "2026-06-23T00:00:00.000Z",
  };
}

describe("coordinate", () => {
  it("runs thinker→worker→verifier and stops on ACCEPT", async () => {
    const deps = makeDeps(["PLAN", "SOLUTION", "looks correct ACCEPT"]);
    const res = await coordinate({ task: "t", pool: ["analyst", "coder", "reviewer"] }, deps);

    expect(res.turns.map((t) => t.role)).toEqual(["thinker", "worker", "verifier"]);
    expect(res.accepted).toBe(true);
    expect(res.answer).toBe("SOLUTION");
    expect(deps.spawn).toHaveBeenCalledTimes(3);
  });

  it("loops worker→verifier on REVISE until maxTurns, then stops unaccepted", async () => {
    const deps = makeDeps(["PLAN", "S1", "REVISE", "S2", "REVISE"]);
    const res = await coordinate(
      { task: "t", pool: ["analyst", "coder", "reviewer"], maxTurns: 5 },
      deps,
    );

    expect(res.accepted).toBe(false);
    expect(res.turns.filter((t) => t.role === "worker")).toHaveLength(2);
    expect(res.answer).toBe("S2"); // last worker output
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/coordinator/coordinate.test.ts`
Expected: FAIL — `Cannot find module './coordinate.js'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/coordinator/coordinate.ts
import { buildRolePrompt, parseVerdict } from "./roles.js";
import { selectProfile, DEFAULT_FALLBACK } from "./policy.js";
import type {
  CoordinationRequest,
  CoordinationResult,
  Policy,
  Role,
  Turn,
} from "./types.js";
import type { SpawnResult } from "../types.js";

export interface CoordinatorDeps {
  /** spawn an agent by profile name with a prompt; resolves to process metadata */
  spawn: (
    profile: string,
    prompt: string,
    outputPath: string,
    cwd?: string,
  ) => Promise<SpawnResult>;
  /** read an agent's textual output from its output file */
  readOutput: (path: string) => string;
  /** deterministic output path for a given profile+turn */
  outputPathFor: (profile: string, turnIndex: number) => string;
  policy: Policy;
  now: () => string;
}

const MAX_TURNS_DEFAULT = 5;

async function runTurn(
  role: Role,
  req: CoordinationRequest,
  transcript: Turn[],
  deps: CoordinatorDeps,
  turnIndex: number,
): Promise<Turn> {
  const profile = selectProfile(
    role,
    req.task,
    req.pool,
    deps.policy,
    DEFAULT_FALLBACK,
  );
  const instruction = buildRolePrompt(role, req.task, transcript);
  const outputPath = deps.outputPathFor(profile, turnIndex);
  const result = await deps.spawn(profile, instruction, outputPath, req.cwd);
  const output = result.status === "ok" ? deps.readOutput(result.outputPath) : "";

  return {
    index: turnIndex,
    role,
    profile,
    model: result.model,
    instruction,
    outputPath: result.outputPath,
    output,
    verdict: role === "verifier" ? parseVerdict(output) : undefined,
    status: result.status,
    durationMs: result.durationMs,
  };
}

export async function coordinate(
  req: CoordinationRequest,
  deps: CoordinatorDeps,
): Promise<CoordinationResult> {
  const maxTurns = req.maxTurns ?? MAX_TURNS_DEFAULT;
  const turns: Turn[] = [];

  // Turn 0: THINKER (once)
  turns.push(await runTurn("thinker", req, turns, deps, 0));

  let accepted = false;
  let lastWorkerOutput = "";

  // Alternate WORKER → VERIFIER until ACCEPT or budget exhausted.
  while (turns.length < maxTurns) {
    const worker = await runTurn("worker", req, turns, deps, turns.length);
    turns.push(worker);
    lastWorkerOutput = worker.output || lastWorkerOutput;

    if (turns.length >= maxTurns) break;

    const verifier = await runTurn("verifier", req, turns, deps, turns.length);
    turns.push(verifier);

    if (verifier.verdict === "ACCEPT") {
      accepted = true;
      break;
    }
  }

  return {
    answer: lastWorkerOutput,
    turns,
    accepted,
    traceId: deps.now(),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/coordinator/coordinate.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/coordinator/coordinate.ts src/coordinator/coordinate.test.ts
git commit -m "feat(coordinator): thinker/worker/verifier loop with REVISE recursion"
```

---

## Milestone M2 — Memory (Obsidian vault)

### Task 5: Trace & policy persistence

**Files:**
- Create: `src/coordinator/memory.ts`
- Test: `src/coordinator/memory.test.ts`

**Interfaces:**
- Consumes: `Trace`, `Policy`, `EMPTY_POLICY` from `./types.js`; Node `fs`.
- Produces:
  - `resolveVaultDir(env?: NodeJS.ProcessEnv): string`
  - `traceToMarkdown(trace: Trace): string`
  - `writeTrace(trace: Trace, baseDir: string): string`
  - `readRecentTraces(baseDir: string, limit: number): Trace[]`
  - `readPolicy(baseDir: string): Policy`
  - `writePolicy(policy: Policy, baseDir: string): string`

- [ ] **Step 1: Write the failing test**

```ts
// src/coordinator/memory.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  resolveVaultDir, writeTrace, readRecentTraces, readPolicy, writePolicy,
} from "./memory.js";
import type { Trace, Policy } from "./types.js";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "vault-")); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

const trace = (id: string): Trace => ({
  id, task: "t " + id, taskTags: ["ts"], turns: [], accepted: true,
  score: 1, createdAt: "2026-06-23T00:00:00.000Z",
});

describe("memory", () => {
  it("resolveVaultDir honors the env override", () => {
    expect(resolveVaultDir({ PROVIDER_AGENTS_VAULT: "/x/y" } as NodeJS.ProcessEnv))
      .toBe("/x/y");
  });

  it("round-trips a trace through markdown", () => {
    writeTrace(trace("a"), dir);
    const got = readRecentTraces(dir, 10);
    expect(got).toHaveLength(1);
    expect(got[0].id).toBe("a");
    expect(got[0].taskTags).toEqual(["ts"]);
    expect(got[0].accepted).toBe(true);
  });

  it("readRecentTraces returns newest first, capped by limit", () => {
    writeTrace(trace("a"), dir);
    writeTrace(trace("b"), dir);
    writeTrace(trace("c"), dir);
    const got = readRecentTraces(dir, 2);
    expect(got.map((t) => t.id)).toEqual(["c", "b"]);
  });

  it("readPolicy returns an empty policy when none exists, then round-trips", () => {
    expect(readPolicy(dir).version).toBe(0);
    const p: Policy = {
      version: 3,
      rules: [{ when: "ts", forRole: "worker", preferProfile: "coder", rationale: "r" }],
      notes: "n", updatedAt: "2026-06-23T00:00:00.000Z",
    };
    writePolicy(p, dir);
    const got = readPolicy(dir);
    expect(got.version).toBe(3);
    expect(got.rules[0].preferProfile).toBe("coder");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/coordinator/memory.test.ts`
Expected: FAIL — `Cannot find module './memory.js'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/coordinator/memory.ts
import {
  readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync,
} from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import type { Policy, Trace } from "./types.js";
import { EMPTY_POLICY } from "./types.js";

const DEFAULT_VAULT = "/home/samuel/Documentos/Obsidian Vault";
const SUBDIR = "coordinator";
const TRACES = "traces";
const POLICY_FILE = "policy.md";

export function resolveVaultDir(env: NodeJS.ProcessEnv = process.env): string {
  return env.PROVIDER_AGENTS_VAULT ?? DEFAULT_VAULT;
}

function coordDir(baseDir: string): string {
  return join(baseDir, SUBDIR);
}

/** Split a `---`-fenced frontmatter doc into (frontmatter object, body). */
function splitFrontmatter(text: string): { data: Record<string, unknown>; body: string } {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: text };
  return { data: (yaml.load(m[1]) as Record<string, unknown>) ?? {}, body: m[2] };
}

function withFrontmatter(data: Record<string, unknown>, body: string): string {
  return `---\n${yaml.dump(data, { lineWidth: -1 })}---\n\n${body}`;
}

export function traceToMarkdown(trace: Trace): string {
  const data = {
    id: trace.id,
    taskTags: trace.taskTags,
    accepted: trace.accepted,
    score: trace.score ?? null,
    createdAt: trace.createdAt,
  };
  const body = [
    `# Trace ${trace.id}`,
    `\n## Task\n${trace.task}`,
    `\n## Turns`,
    ...trace.turns.map(
      (t) =>
        `\n### ${t.index} — ${t.role} (${t.profile}, ${t.model})` +
        (t.verdict ? ` → ${t.verdict}` : "") +
        `\n${t.output}`,
    ),
  ].join("\n");
  return withFrontmatter(data, body);
}

export function writeTrace(trace: Trace, baseDir: string): string {
  const dir = join(coordDir(baseDir), TRACES);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${trace.id}.md`);
  writeFileSync(path, traceToMarkdown(trace), "utf-8");
  return path;
}

export function readRecentTraces(baseDir: string, limit: number): Trace[] {
  const dir = join(coordDir(baseDir), TRACES);
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .reverse()
    .slice(0, limit);

  return files.map((f) => {
    const { data, body } = splitFrontmatter(readFileSync(join(dir, f), "utf-8"));
    const taskMatch = body.match(/## Task\n([\s\S]*?)\n## Turns/);
    return {
      id: String(data.id ?? f.replace(/\.md$/, "")),
      task: taskMatch ? taskMatch[1].trim() : "",
      taskTags: (data.taskTags as string[]) ?? [],
      turns: [],
      accepted: Boolean(data.accepted),
      score: data.score == null ? undefined : Number(data.score),
      createdAt: String(data.createdAt ?? ""),
    };
  });
}

export function readPolicy(baseDir: string): Policy {
  const path = join(coordDir(baseDir), POLICY_FILE);
  if (!existsSync(path)) return EMPTY_POLICY;
  const { data } = splitFrontmatter(readFileSync(path, "utf-8"));
  return {
    version: Number(data.version ?? 0),
    rules: (data.rules as Policy["rules"]) ?? [],
    notes: String(data.notes ?? ""),
    updatedAt: String(data.updatedAt ?? EMPTY_POLICY.updatedAt),
  };
}

export function writePolicy(policy: Policy, baseDir: string): string {
  const dir = coordDir(baseDir);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, POLICY_FILE);
  const body = [
    `# Coordinator Policy (v${policy.version})`,
    `\nUpdated: ${policy.updatedAt}`,
    `\n## Notes\n${policy.notes}`,
    `\n## Rules`,
    ...policy.rules.map(
      (r) => `- when \`${r.when}\` & role **${r.forRole}** → \`${r.preferProfile}\` (${r.rationale})`,
    ),
  ].join("\n");
  writeFileSync(
    path,
    withFrontmatter(
      { version: policy.version, rules: policy.rules, notes: policy.notes, updatedAt: policy.updatedAt },
      body,
    ),
    "utf-8",
  );
  return path;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/coordinator/memory.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/coordinator/memory.ts src/coordinator/memory.test.ts
git commit -m "feat(coordinator): Obsidian trace and policy persistence"
```

---

### Task 6: Trace builder + tagging

**Files:**
- Create: `src/coordinator/trace.ts`
- Test: `src/coordinator/trace.test.ts`

**Interfaces:**
- Consumes: `CoordinationResult`, `Trace`, `Turn` from `./types.js`.
- Produces:
  - `deriveTags(task: string): string[]`
  - `buildTrace(task: string, result: CoordinationResult, createdAt: string): Trace`

- [ ] **Step 1: Write the failing test**

```ts
// src/coordinator/trace.test.ts
import { describe, it, expect } from "vitest";
import { deriveTags, buildTrace } from "./trace.js";
import type { CoordinationResult } from "./types.js";

describe("trace", () => {
  it("deriveTags picks language/domain keywords", () => {
    expect(deriveTags("Fix a TypeScript async race")).toContain("typescript");
    expect(deriveTags("review this SQL query")).toContain("sql");
    expect(deriveTags("nothing special")).toEqual(["general"]);
  });

  it("buildTrace copies id from result and tags from task", () => {
    const result: CoordinationResult = {
      answer: "A", accepted: true, traceId: "2026-06-23T00:00:00.000Z", turns: [],
    };
    const t = buildTrace("a python bug", result, "2026-06-23T00:00:00.000Z");
    expect(t.id).toBe("2026-06-23T00:00:00.000Z");
    expect(t.taskTags).toContain("python");
    expect(t.accepted).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/coordinator/trace.test.ts`
Expected: FAIL — `Cannot find module './trace.js'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/coordinator/trace.ts
import type { CoordinationResult, Trace } from "./types.js";

const TAG_KEYWORDS: Record<string, string[]> = {
  typescript: ["typescript", "tsx", ".ts"],
  javascript: ["javascript", "node.js", "nodejs"],
  python: ["python", ".py"],
  csharp: ["c#", ".net", "csharp"],
  sql: ["sql", "postgres", "query"],
  security: ["security", "owasp", "vulnerab"],
  refactor: ["refactor", "cleanup", "dead code"],
};

export function deriveTags(task: string): string[] {
  const lc = task.toLowerCase();
  const tags = Object.entries(TAG_KEYWORDS)
    .filter(([, kws]) => kws.some((k) => lc.includes(k)))
    .map(([tag]) => tag);
  return tags.length > 0 ? tags : ["general"];
}

export function buildTrace(
  task: string,
  result: CoordinationResult,
  createdAt: string,
): Trace {
  return {
    id: result.traceId,
    task,
    taskTags: deriveTags(task),
    turns: result.turns,
    accepted: result.accepted,
    createdAt,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/coordinator/trace.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/coordinator/trace.ts src/coordinator/trace.test.ts
git commit -m "feat(coordinator): trace builder with task tagging"
```

---

## Milestone M3 — MoA, shared knowledge base, and reflection

### Task 7: Mixture-of-Agents fan-out

**Files:**
- Create: `src/coordinator/moa.ts`
- Test: `src/coordinator/moa.test.ts`

**Interfaces:**
- Consumes: `CoordinatorDeps` from `./coordinate.js`.
- Produces: `mixtureOfAgents(task: string, proposers: string[], aggregator: string, deps: CoordinatorDeps): Promise<{ answer: string; proposals: string[] }>`
  - Proposers run concurrently (one spawn each); the aggregator receives all proposals and synthesizes one answer.

- [ ] **Step 1: Write the failing test**

```ts
// src/coordinator/moa.test.ts
import { describe, it, expect, vi } from "vitest";
import { mixtureOfAgents } from "./moa.js";
import type { CoordinatorDeps } from "./coordinate.js";
import { EMPTY_POLICY } from "./types.js";
import type { SpawnResult } from "../types.js";

function deps(map: Record<string, string>): CoordinatorDeps {
  return {
    spawn: vi.fn(async (profile: string): Promise<SpawnResult> => ({
      status: "ok", exitCode: 0, outputPath: `/out/${profile}`, profile, model: "m", durationMs: 1,
    })),
    readOutput: (path: string) => map[path] ?? "",
    outputPathFor: (p) => `/out/${p}`,
    policy: EMPTY_POLICY,
    now: () => "t",
  };
}

describe("mixtureOfAgents", () => {
  it("collects all proposer outputs and returns the aggregator's synthesis", async () => {
    const d = deps({
      "/out/openrouter-coder": "P1",
      "/out/coder": "P2",
      "/out/aggregator": "FINAL",
    });
    const res = await mixtureOfAgents("task", ["openrouter-coder", "coder"], "aggregator", d);
    expect(res.proposals).toEqual(["P1", "P2"]);
    expect(res.answer).toBe("FINAL");
    expect(d.spawn).toHaveBeenCalledTimes(3); // 2 proposers + 1 aggregator
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/coordinator/moa.test.ts`
Expected: FAIL — `Cannot find module './moa.js'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/coordinator/moa.ts
import type { CoordinatorDeps } from "./coordinate.js";

const PROPOSER_BRIEF =
  "Propose your best independent solution to the task. Be concrete and complete.";

function aggregatorPrompt(task: string, proposals: string[]): string {
  const listed = proposals
    .map((p, i) => `### Proposal ${i + 1}\n${p}`)
    .join("\n\n");
  return [
    "You are the AGGREGATOR. Several agents proposed solutions to the task.",
    "Synthesize a single best answer: keep what is correct, discard what is wrong,",
    "and reconcile contradictions. Cite which proposal a claim came from when it matters.",
    `\n## Task\n${task}`,
    `\n## Proposals\n${listed}`,
  ].join("\n");
}

export async function mixtureOfAgents(
  task: string,
  proposers: string[],
  aggregator: string,
  deps: CoordinatorDeps,
): Promise<{ answer: string; proposals: string[] }> {
  const proposals = await Promise.all(
    proposers.map(async (profile, i) => {
      const outputPath = deps.outputPathFor(profile, i);
      const prompt = `${PROPOSER_BRIEF}\n\n## Task\n${task}`;
      const r = await deps.spawn(profile, prompt, outputPath);
      return r.status === "ok" ? deps.readOutput(r.outputPath) : "";
    }),
  );

  const aggPath = deps.outputPathFor(aggregator, proposers.length);
  const aggRes = await deps.spawn(aggregator, aggregatorPrompt(task, proposals), aggPath);
  const answer = aggRes.status === "ok" ? deps.readOutput(aggRes.outputPath) : "";

  return { answer, proposals };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/coordinator/moa.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/coordinator/moa.ts src/coordinator/moa.test.ts
git commit -m "feat(coordinator): mixture-of-agents fan-out and aggregation"
```

---

### Task 8: Shared knowledge-base injection (the Obsidian wiring)

**Files:**
- Create: `src/coordinator/knowledge.ts`
- Test: `src/coordinator/knowledge.test.ts`

**Interfaces:**
- Consumes: `Policy` from `./types.js`; `readPolicy` from `./memory.js`.
- Produces:
  - `kbExtraArgs(baseDir: string): string[]` — `["--add-dir", "<vault>/coordinator"]` so every claude-p agent can READ the shared KB (policy + traces) as files.
  - `kbPreamble(policy: Policy): string` — a compact text block (current policy) the coordinator prepends to every agent prompt, so even `cli` agents (which cannot take `mcp_config`) share the knowledge.

> **Design note (the user's mechanism):** claude-p profiles get the live Obsidian MCP via `mcp_config` in `profiles.yaml` (Task 11). For everything else — and as the always-on baseline — the coordinator injects `kbPreamble()` into prompts and exposes the vault via `--add-dir`. This realizes "agents share one knowledge base" without depending on the MCP server being up.

- [ ] **Step 1: Write the failing test**

```ts
// src/coordinator/knowledge.test.ts
import { describe, it, expect } from "vitest";
import { kbExtraArgs, kbPreamble } from "./knowledge.js";
import type { Policy } from "./types.js";

describe("knowledge", () => {
  it("kbExtraArgs points --add-dir at the coordinator KB folder", () => {
    expect(kbExtraArgs("/vault")).toEqual(["--add-dir", "/vault/coordinator"]);
  });

  it("kbPreamble summarizes the active policy rules", () => {
    const p: Policy = {
      version: 2,
      rules: [{ when: "typescript", forRole: "worker", preferProfile: "coder", rationale: "fast" }],
      notes: "prefer evidence", updatedAt: "2026-06-23T00:00:00.000Z",
    };
    const text = kbPreamble(p);
    expect(text).toContain("policy v2");
    expect(text).toContain("typescript");
    expect(text).toContain("coder");
  });

  it("kbPreamble is concise when the policy is empty", () => {
    const text = kbPreamble({ version: 0, rules: [], notes: "", updatedAt: "x" });
    expect(text).toContain("no learned policy");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/coordinator/knowledge.test.ts`
Expected: FAIL — `Cannot find module './knowledge.js'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/coordinator/knowledge.ts
import { join } from "node:path";
import type { Policy } from "./types.js";

export function kbExtraArgs(baseDir: string): string[] {
  return ["--add-dir", join(baseDir, "coordinator")];
}

export function kbPreamble(policy: Policy): string {
  if (policy.rules.length === 0) {
    return "## Shared knowledge base\n(no learned policy yet — use your best judgment.)";
  }
  const rules = policy.rules
    .map((r) => `- ${r.forRole}: when task ~ \`${r.when}\` prefer \`${r.preferProfile}\` (${r.rationale})`)
    .join("\n");
  return [
    `## Shared knowledge base — policy v${policy.version}`,
    policy.notes ? `Notes: ${policy.notes}` : "",
    rules,
  ]
    .filter(Boolean)
    .join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/coordinator/knowledge.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/coordinator/knowledge.ts src/coordinator/knowledge.test.ts
git commit -m "feat(coordinator): shared knowledge-base injection (--add-dir + policy preamble)"
```

---

### Task 9: Reflection — evolve the policy from traces

**Files:**
- Create: `src/coordinator/reflect.ts`
- Test: `src/coordinator/reflect.test.ts`

**Interfaces:**
- Consumes: `readRecentTraces`, `readPolicy`, `writePolicy` (`./memory.js`); `Policy`, `Trace` (`./types.js`); `SpawnResult` (`../types.js`).
- Produces:
  - `ReflectDeps`: `{ spawn, readOutput, outputPathFor, now }`
  - `buildReflectionPrompt(traces: Trace[], current: Policy): string`
  - `parsePolicyProposal(raw: string): { rules: Policy["rules"]; notes: string }` — parses a fenced ```json block.
  - `reflect(baseDir: string, reflector: string, traceLimit: number, deps: ReflectDeps): Promise<Policy>`

- [ ] **Step 1: Write the failing test**

```ts
// src/coordinator/reflect.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parsePolicyProposal, reflect, type ReflectDeps } from "./reflect.js";
import { writeTrace, readPolicy } from "./memory.js";
import type { Trace } from "./types.js";
import type { SpawnResult } from "../types.js";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "vault-")); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

const trace = (id: string): Trace => ({
  id, task: "typescript bug " + id, taskTags: ["typescript"], turns: [],
  accepted: true, score: 1, createdAt: "2026-06-23T00:00:00.000Z",
});

describe("reflect", () => {
  it("parsePolicyProposal reads a fenced json block", () => {
    const raw = 'noise\n```json\n{"rules":[{"when":"ts","forRole":"worker","preferProfile":"coder","rationale":"r"}],"notes":"n"}\n```\n';
    const got = parsePolicyProposal(raw);
    expect(got.rules[0].preferProfile).toBe("coder");
    expect(got.notes).toBe("n");
  });

  it("reflect writes a new policy with version bumped", async () => {
    writeTrace(trace("a"), dir);
    const proposal = '```json\n{"rules":[{"when":"typescript","forRole":"worker","preferProfile":"coder","rationale":"wins"}],"notes":"learned"}\n```';
    const deps: ReflectDeps = {
      spawn: vi.fn(async (): Promise<SpawnResult> => ({
        status: "ok", exitCode: 0, outputPath: "/out/reflector", profile: "reflector", model: "m", durationMs: 1,
      })),
      readOutput: () => proposal,
      outputPathFor: (p) => `/out/${p}`,
      now: () => "2026-06-23T12:00:00.000Z",
    };
    const updated = await reflect(dir, "reflector", 20, deps);
    expect(updated.version).toBe(1);
    expect(updated.rules[0].preferProfile).toBe("coder");
    expect(readPolicy(dir).version).toBe(1); // persisted
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/coordinator/reflect.test.ts`
Expected: FAIL — `Cannot find module './reflect.js'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/coordinator/reflect.ts
import { readRecentTraces, readPolicy, writePolicy } from "./memory.js";
import type { Policy, Trace } from "./types.js";
import type { SpawnResult } from "../types.js";

export interface ReflectDeps {
  spawn: (profile: string, prompt: string, outputPath: string) => Promise<SpawnResult>;
  readOutput: (path: string) => string;
  outputPathFor: (profile: string, turnIndex: number) => string;
  now: () => string;
}

export function buildReflectionPrompt(traces: Trace[], current: Policy): string {
  const summary = traces
    .map(
      (t) =>
        `- [${t.accepted ? "ACCEPT" : "FAIL"}, score=${t.score ?? "?"}] tags=${t.taskTags.join(",")} :: ${t.task}`,
    )
    .join("\n");
  const currentRules = JSON.stringify(current.rules, null, 2);
  return [
    "You are the REFLECTOR. You evolve the coordinator's routing policy from past runs.",
    "Diagnose patterns: which profile/role choices led to ACCEPT and high scores for which task tags.",
    "Propose an improved, MINIMAL set of routing rules. Keep rules that still hold; drop or fix the rest.",
    "Output ONLY a fenced ```json block of the shape:",
    '{"rules":[{"when":"<lowercase task substring/tag>","forRole":"thinker|worker|verifier","preferProfile":"<profile name>","rationale":"<short why>"}],"notes":"<one-paragraph summary of what you learned>"}',
    `\n## Current policy rules\n${currentRules}`,
    `\n## Recent runs (newest first)\n${summary}`,
  ].join("\n");
}

export function parsePolicyProposal(raw: string): { rules: Policy["rules"]; notes: string } {
  const m = raw.match(/```json\s*([\s\S]*?)```/);
  const jsonText = m ? m[1] : raw;
  try {
    const parsed = JSON.parse(jsonText) as { rules?: Policy["rules"]; notes?: string };
    return { rules: parsed.rules ?? [], notes: parsed.notes ?? "" };
  } catch {
    return { rules: [], notes: "" };
  }
}

export async function reflect(
  baseDir: string,
  reflector: string,
  traceLimit: number,
  deps: ReflectDeps,
): Promise<Policy> {
  const traces = readRecentTraces(baseDir, traceLimit);
  const current = readPolicy(baseDir);

  const prompt = buildReflectionPrompt(traces, current);
  const outputPath = deps.outputPathFor(reflector, 0);
  const result = await deps.spawn(reflector, prompt, outputPath);
  const raw = result.status === "ok" ? deps.readOutput(result.outputPath) : "";
  const { rules, notes } = parsePolicyProposal(raw);

  const updated: Policy = {
    version: current.version + 1,
    rules,
    notes,
    updatedAt: deps.now(),
  };
  writePolicy(updated, baseDir);
  return updated;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/coordinator/reflect.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/coordinator/reflect.ts src/coordinator/reflect.test.ts
git commit -m "feat(coordinator): reflection loop that evolves policy from traces"
```

---

### Task 10: Wire real spawn/IO and expose MCP tools

**Files:**
- Create: `src/coordinator/runtime.ts` (adapters binding `CoordinatorDeps`/`ReflectDeps` to the real `spawnAgent`, output files, and `loadMergedConfig`)
- Create: `src/coordinator/index.ts` (barrel)
- Modify: `src/index.ts` (register `coordinate` and `reflect_policy` MCP tools)
- Test: `src/coordinator/runtime.test.ts`

**Interfaces:**
- Consumes: `spawnAgent` (`../spawner.js`), `loadMergedConfig` (`../config.js`), `coordinate`, `mixtureOfAgents`, `reflect`, `buildTrace`, `writeTrace`, `readPolicy`, `resolveVaultDir`, `kbExtraArgs`, `kbPreamble`.
- Produces:
  - `makeCoordinatorDeps(opts: { projectDir: string; vaultDir: string; outputDir: string }): CoordinatorDeps`
  - `runCoordination(req, opts): Promise<CoordinationResult>` — full path: load policy → coordinate → buildTrace → writeTrace.
  - `runReflection(opts): Promise<Policy>`

- [ ] **Step 1: Write the failing test** (adapter wiring, still DI for spawn)

```ts
// src/coordinator/runtime.test.ts
import { describe, it, expect, vi } from "vitest";
import { makeCoordinatorDeps } from "./runtime.js";

describe("runtime adapters", () => {
  it("outputPathFor produces unique paths per profile+turn under the output dir", () => {
    const deps = makeCoordinatorDeps({
      projectDir: "/proj", vaultDir: "/vault", outputDir: "/out",
      spawnImpl: vi.fn(), readImpl: () => "",
    });
    const a = deps.outputPathFor("coder", 1);
    const b = deps.outputPathFor("coder", 2);
    expect(a).not.toBe(b);
    expect(a.startsWith("/out/")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/coordinator/runtime.test.ts`
Expected: FAIL — `Cannot find module './runtime.js'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/coordinator/runtime.ts
import { join } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { spawnAgent } from "../spawner.js";
import { loadMergedConfig } from "../config.js";
import { coordinate, type CoordinatorDeps } from "./coordinate.js";
import { reflect, type ReflectDeps } from "./reflect.js";
import { readPolicy, writeTrace, resolveVaultDir } from "./memory.js";
import { buildTrace } from "./trace.js";
import { kbExtraArgs, kbPreamble } from "./knowledge.js";
import type { CoordinationRequest, CoordinationResult, Policy } from "./types.js";
import type { SpawnResult } from "../types.js";

export interface RuntimeOpts {
  projectDir: string;
  vaultDir: string;
  outputDir: string;
  /** test seam: override the real spawn */
  spawnImpl?: (profile: string, prompt: string, outputPath: string, cwd?: string) => Promise<SpawnResult>;
  /** test seam: override file read */
  readImpl?: (path: string) => string;
}

function realRead(path: string): string {
  return existsSync(path) ? readFileSync(path, "utf-8") : "";
}

export function makeCoordinatorDeps(opts: RuntimeOpts): CoordinatorDeps {
  const config = opts.spawnImpl ? null : loadMergedConfig(opts.projectDir);
  const policy = readPolicy(opts.vaultDir);
  const preamble = kbPreamble(policy);
  const kbArgs = kbExtraArgs(opts.vaultDir);

  const realSpawn = async (
    profile: string, prompt: string, outputPath: string, cwd?: string,
  ): Promise<SpawnResult> => {
    const p = config!.profiles[profile];
    if (!p) {
      return { status: "error", exitCode: 1, outputPath, profile, model: "unknown", durationMs: 0 };
    }
    // KB sharing: prepend policy preamble; expose vault via --add-dir for claude-p.
    const enriched = `${preamble}\n\n${prompt}`;
    const extra = p.invocation === "claude-p" ? kbArgs : undefined;
    return spawnAgent(p, profile, enriched, outputPath, extra, cwd);
  };

  return {
    spawn: opts.spawnImpl ?? realSpawn,
    readOutput: opts.readImpl ?? realRead,
    outputPathFor: (profile, turnIndex) =>
      join(opts.outputDir, `${profile}-${turnIndex}.md`),
    policy,
    now: () => new Date().toISOString(),
  };
}

export async function runCoordination(
  req: CoordinationRequest,
  opts: RuntimeOpts,
): Promise<CoordinationResult> {
  const deps = makeCoordinatorDeps(opts);
  const result = await coordinate(req, deps);
  const trace = buildTrace(req.task, result, new Date().toISOString());
  writeTrace(trace, opts.vaultDir);
  return result;
}

export async function runReflection(opts: RuntimeOpts & { reflector: string; traceLimit: number }): Promise<Policy> {
  const base = makeCoordinatorDeps(opts);
  const deps: ReflectDeps = {
    spawn: base.spawn as ReflectDeps["spawn"],
    readOutput: base.readOutput,
    outputPathFor: base.outputPathFor,
    now: () => new Date().toISOString(),
  };
  return reflect(opts.vaultDir, opts.reflector, opts.traceLimit, deps);
}

export { resolveVaultDir };
```

```ts
// src/coordinator/index.ts
export * from "./types.js";
export { coordinate } from "./coordinate.js";
export { mixtureOfAgents } from "./moa.js";
export { reflect } from "./reflect.js";
export { runCoordination, runReflection, resolveVaultDir } from "./runtime.js";
```

- [ ] **Step 4: Register MCP tools in `src/index.ts`**

Use the repo's real registration API — `server.registerTool(name, { title, description, inputSchema: z.object({...}) }, handler)` — verified against the existing `spawn_agent`/`suggest_profile` tools (`src/index.ts:165, 328`). `z` is imported as `import * as z from "zod"` (already at the top of the file). All content items use `type: "text" as const`. Add the import and the two `registerTool` blocks alongside the existing ones:

```ts
// in src/index.ts — add to the import block at the top
import { runCoordination, runReflection, resolveVaultDir } from "./coordinator/index.js";

// register alongside the other server.registerTool(...) calls:
server.registerTool(
  "coordinate",
  {
    title: "Coordinate",
    description:
      "Run a Thinker/Worker/Verifier coordination over a pool of provider-agent profiles; logs a trace to the Obsidian vault.",
    inputSchema: z.object({
      task: z.string().describe("The task to coordinate over"),
      pool: z.array(z.string()).min(1).describe("Candidate profile names the coordinator may route to"),
      maxTurns: z.number().int().min(1).max(10).optional().describe("Hard cap on turns (default 5)"),
      moa: z.boolean().optional().describe("Run the worker step as a Mixture-of-Agents fan-out"),
      cwd: z.string().optional().describe("Working directory for spawned agents"),
    }),
  },
  async ({ task, pool, maxTurns, moa, cwd }) => {
    const projectDir = process.cwd();
    const vaultDir = resolveVaultDir();
    const outputDir = "/tmp/provider-agents/coordinator";
    const result = await runCoordination(
      { task, pool, maxTurns, moa, cwd },
      { projectDir, vaultDir, outputDir },
    );
    return {
      content: [
        { type: "text" as const, text: result.answer },
        {
          type: "text" as const,
          text: `\n\n---\naccepted=${result.accepted} turns=${result.turns.length} trace=${result.traceId}`,
        },
      ],
      isError: !result.accepted,
    };
  },
);

server.registerTool(
  "reflect_policy",
  {
    title: "Reflect Policy",
    description:
      "Read recent coordination traces and evolve the routing policy note in the Obsidian vault.",
    inputSchema: z.object({
      reflector: z.string().default("reflector").describe("Profile name used for reflection"),
      traceLimit: z.number().int().min(1).max(200).default(30).describe("How many recent traces to reflect over"),
    }),
  },
  async ({ reflector, traceLimit }) => {
    const vaultDir = resolveVaultDir();
    const policy = await runReflection({
      projectDir: process.cwd(),
      vaultDir,
      outputDir: "/tmp/provider-agents/coordinator",
      reflector,
      traceLimit,
    });
    return {
      content: [
        { type: "text" as const, text: `Policy updated to v${policy.version} with ${policy.rules.length} rules.` },
      ],
    };
  },
);
```

- [ ] **Step 5: Run typecheck, tests, and build**

Run: `npm run typecheck && npm test && npm run build`
Expected: typecheck clean; all coordinator tests PASS; build emits `build/index.js`.

- [ ] **Step 6: Commit**

```bash
git add src/coordinator/runtime.ts src/coordinator/index.ts src/index.ts
git commit -m "feat(coordinator): runtime adapters + coordinate/reflect_policy MCP tools"
```

---

### Task 11: Coordinator profiles + Obsidian MCP wiring (in `deepclaude`)

**Files (in `/home/samuel/Documentos/blis/repos/deepclaude`):**
- Create: `.claude/obsidian.mcp.json`
- Modify: `.claude/profiles.yaml` (append role profiles)

**Interfaces:**
- Consumes: nothing in code — these are config the coordinator routes to by name (`thinker`, `worker`, `verifier`, `aggregator`, `reflector`).
- Produces: profile names the coordinator's `DEFAULT_FALLBACK` and pools reference.

- [ ] **Step 1: Create the Obsidian MCP config (opt-in, token from env)**

```json
// .claude/obsidian.mcp.json
{
  "mcpServers": {
    "obsidian": {
      "type": "http",
      "url": "http://127.0.0.1:3010/mcp",
      "headers": { "Authorization": "Bearer ${OBSIDIAN_MCP_TOKEN}" }
    }
  }
}
```

> The URL/port must match the `mcp-tools-istefox` "MCP Connector" plugin settings in the vault; `OBSIDIAN_MCP_TOKEN` is sourced from `.env` by `scripts/spawn.sh` (it `source`s `$PROJECT_DIR/.env`). NEVER hardcode the token. This file is only consumed by `claude-p` profiles via `mcp_config`.

- [ ] **Step 2: Append role profiles to `.claude/profiles.yaml`**

Add under `profiles:` (claude-p roles get the Obsidian MCP; the worker stays a strong coder). Reuse existing credential JSONs already referenced in the file:

```yaml
  thinker:
    invocation: claude-p
    settings: /home/samuel/Documentos/blis/repos/deepclaude/.claude/deepseek.json
    model: deepseek-v4-pro[1m]
    bare: true
    tags: [coordinator, thinker, plan, decompose]
    mcp_config: [/home/samuel/Documentos/blis/repos/deepclaude/.claude/obsidian.mcp.json]
    system_prompt: |-
      You are the THINKER in a multi-agent coordinator. Respond in Portuguese (pt-BR).
      Decompose tasks into a concrete plan; do not produce the final solution.
      Read the shared knowledge base (Obsidian) when it helps. Separate verified facts from hypotheses.
      Never print, echo or log secrets.
    description: Coordinator THINKER. DeepSeek Pro, decomposição e estratégia, com KB Obsidian.

  worker:
    invocation: claude-p
    settings: /home/samuel/Documentos/blis/repos/deepclaude/.claude/deepseek.json
    model: deepseek-v4-pro[1m]
    bare: true
    tags: [coordinator, worker, implement]
    mcp_config: [/home/samuel/Documentos/blis/repos/deepclaude/.claude/obsidian.mcp.json]
    system_prompt: |-
      You are the WORKER in a multi-agent coordinator. Respond in Portuguese (pt-BR).
      Execute the plan and produce the concrete solution. Every claim needs evidence (file:line or output).
      Never print, echo or log secrets.
    description: Coordinator WORKER. DeepSeek Pro, execução concreta, com KB Obsidian.

  verifier:
    invocation: claude-p
    settings: /home/samuel/Documentos/blis/repos/deepclaude/.claude/deepseek.json
    model: deepseek-v4-pro[1m]
    bare: true
    tags: [coordinator, verifier, check]
    mcp_config: [/home/samuel/Documentos/blis/repos/deepclaude/.claude/obsidian.mcp.json]
    system_prompt: |-
      You are the VERIFIER in a multi-agent coordinator. Respond in Portuguese (pt-BR).
      Check the latest solution for correctness and completeness. End with exactly one token: ACCEPT or REVISE.
      Never print, echo or log secrets.
    description: Coordinator VERIFIER. DeepSeek Pro, checagem ACCEPT/REVISE, com KB Obsidian.

  aggregator:
    invocation: claude-p
    settings: /home/samuel/Documentos/blis/repos/deepclaude/.claude/kimi.json
    model: kimi-k2.6
    bare: true
    tags: [coordinator, aggregator, synthesis]
    mcp_config: [/home/samuel/Documentos/blis/repos/deepclaude/.claude/obsidian.mcp.json]
    system_prompt: |-
      You are the AGGREGATOR. Respond in Portuguese (pt-BR). Synthesize multiple proposals into one best answer,
      keeping what is correct and discarding what is wrong. Never print, echo or log secrets.
    description: Coordinator AGGREGATOR. Kimi K2.6 (long-context), síntese MoA.

  reflector:
    invocation: claude-p
    settings: /home/samuel/Documentos/blis/repos/deepclaude/.claude/deepseek.json
    model: deepseek-v4-pro[1m]
    bare: true
    tags: [coordinator, reflector, policy]
    mcp_config: [/home/samuel/Documentos/blis/repos/deepclaude/.claude/obsidian.mcp.json]
    system_prompt: |-
      You are the REFLECTOR. Respond with ONLY a fenced json block as instructed.
      You evolve the coordinator routing policy from past traces. Never print, echo or log secrets.
    description: Coordinator REFLECTOR. DeepSeek Pro, evolui a política a partir de traces.
```

- [ ] **Step 3: Validate the profiles parse**

Run: `bash /home/samuel/Documentos/blis/repos/deepclaude/scripts/spawn.sh` (no args)
Expected: the profile list prints and includes `thinker`, `worker`, `verifier`, `aggregator`, `reflector` with no YAML error.

- [ ] **Step 4: Commit (in the deepclaude repo)**

```bash
git -C /home/samuel/Documentos/blis/repos/deepclaude add .claude/obsidian.mcp.json .claude/profiles.yaml
git -C /home/samuel/Documentos/blis/repos/deepclaude commit -m "feat(profiles): coordinator roles with shared Obsidian knowledge base"
```

---

## Milestone M4 — Proving "≥ Sakana" (eval harness)

### Task 12: LLM-judge metric

**Files:**
- Create: `eval/judge.ts`
- Test: `eval/judge.test.ts`

**Interfaces:**
- Produces:
  - `buildJudgePrompt(task: string, answer: string, reference: string): string`
  - `parseScore(raw: string): number` — extracts a 0–1 score from a `SCORE: x` line.
  - `judge(task, answer, reference, deps): Promise<number>`

- [ ] **Step 1: Write the failing test**

```ts
// eval/judge.test.ts
import { describe, it, expect, vi } from "vitest";
import { parseScore, buildJudgePrompt, judge } from "./judge.js";

describe("judge", () => {
  it("parseScore reads SCORE line, clamps to [0,1]", () => {
    expect(parseScore("reasoning...\nSCORE: 0.8")).toBe(0.8);
    expect(parseScore("SCORE: 5")).toBe(1);
    expect(parseScore("no score")).toBe(0);
  });

  it("buildJudgePrompt includes task, answer and reference", () => {
    const p = buildJudgePrompt("T", "A", "R");
    expect(p).toContain("T"); expect(p).toContain("A"); expect(p).toContain("R");
  });

  it("judge returns the parsed score from the judge agent output", async () => {
    const deps = { run: vi.fn(async () => "SCORE: 0.9") };
    expect(await judge("t", "a", "r", deps)).toBe(0.9);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- eval/judge.test.ts`
Expected: FAIL — `Cannot find module './judge.js'`.

> Vitest must include `eval/`. If `vitest.config.ts` restricts `include` to `src/`, add `"eval/**/*.test.ts"` to the `include` array in the same step.

- [ ] **Step 3: Write minimal implementation**

```ts
// eval/judge.ts
export interface JudgeDeps {
  run: (prompt: string) => Promise<string>;
}

export function buildJudgePrompt(task: string, answer: string, reference: string): string {
  return [
    "You are an impartial grader. Compare the ANSWER to the REFERENCE for the TASK.",
    "Score correctness and completeness from 0.0 to 1.0. End with a line: SCORE: <number>.",
    `\n## Task\n${task}`,
    `\n## Reference\n${reference}`,
    `\n## Answer\n${answer}`,
  ].join("\n");
}

export function parseScore(raw: string): number {
  const m = raw.match(/SCORE:\s*([0-9]*\.?[0-9]+)/i);
  if (!m) return 0;
  const n = Number(m[1]);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export async function judge(
  task: string,
  answer: string,
  reference: string,
  deps: JudgeDeps,
): Promise<number> {
  const raw = await deps.run(buildJudgePrompt(task, answer, reference));
  return parseScore(raw);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- eval/judge.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add eval/judge.ts eval/judge.test.ts vitest.config.ts
git commit -m "feat(eval): LLM-judge metric for coordinator answers"
```

---

### Task 13: Eval runner (baseline vs coordinator) + dataset

**Files:**
- Create: `eval/tasks/ours.jsonl` (seed with 5 real tasks; each line `{ "task": "...", "reference": "...", "pool": ["analyst","coder","reviewer"] }`)
- Create: `eval/run-eval.ts`
- Test: `eval/run-eval.test.ts`

**Interfaces:**
- Consumes: `runCoordination` (`../src/coordinator/index.js`), `judge` (`./judge.js`), `spawnAgent` for the single-agent baseline.
- Produces:
  - `loadTasks(path: string): EvalTask[]`
  - `summarize(rows: EvalRow[]): { baselineMean: number; coordMean: number; wins: number; n: number }`
  - `main()` — CLI entry that prints the report.

- [ ] **Step 1: Write the failing test (pure logic: loading + summary)**

```ts
// eval/run-eval.test.ts
import { describe, it, expect } from "vitest";
import { summarize, type EvalRow } from "./run-eval.js";

describe("eval summary", () => {
  it("computes means, win count and n", () => {
    const rows: EvalRow[] = [
      { task: "a", baseline: 0.5, coord: 0.9 },
      { task: "b", baseline: 0.8, coord: 0.8 },
      { task: "c", baseline: 0.6, coord: 0.4 },
    ];
    const s = summarize(rows);
    expect(s.n).toBe(3);
    expect(s.wins).toBe(1); // only "a" strictly improved
    expect(Number(s.coordMean.toFixed(2))).toBe(0.7);
    expect(Number(s.baselineMean.toFixed(2))).toBe(0.63);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- eval/run-eval.test.ts`
Expected: FAIL — `Cannot find module './run-eval.js'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// eval/run-eval.ts
import { readFileSync } from "node:fs";
import { runCoordination, resolveVaultDir } from "../src/coordinator/index.js";
import { spawnAgent } from "../src/spawner.js";
import { loadMergedConfig } from "../src/config.js";
import { judge } from "./judge.js";

export interface EvalTask { task: string; reference: string; pool: string[]; }
export interface EvalRow { task: string; baseline: number; coord: number; }

export function loadTasks(path: string): EvalTask[] {
  return readFileSync(path, "utf-8")
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as EvalTask);
}

export function summarize(rows: EvalRow[]) {
  const n = rows.length;
  const baselineMean = rows.reduce((a, r) => a + r.baseline, 0) / n;
  const coordMean = rows.reduce((a, r) => a + r.coord, 0) / n;
  const wins = rows.filter((r) => r.coord > r.baseline).length;
  return { baselineMean, coordMean, wins, n };
}

// --- CLI entry (not unit-tested; runs real agents) ---
export async function main(): Promise<void> {
  const tasksPath = process.argv[2] ?? "eval/tasks/ours.jsonl";
  const tasks = loadTasks(tasksPath);
  const vaultDir = resolveVaultDir();
  const projectDir = process.cwd();
  const outputDir = "/tmp/provider-agents/eval";
  const config = loadMergedConfig(projectDir);

  const judgeRun = async (prompt: string): Promise<string> => {
    const out = `/tmp/provider-agents/eval/judge-${Date.now()}.md`;
    const p = config.profiles["analyst"];
    const r = await spawnAgent(p, "analyst", prompt, out);
    return r.status === "ok" ? readFileSync(r.outputPath, "utf-8") : "";
  };

  const rows: EvalRow[] = [];
  for (const t of tasks) {
    // baseline = single strongest worker
    const baseOut = `/tmp/provider-agents/eval/base-${Date.now()}.md`;
    const baseProfile = config.profiles[t.pool[1] ?? t.pool[0]];
    const baseRes = await spawnAgent(baseProfile, t.pool[1] ?? t.pool[0], t.task, baseOut);
    const baseAnswer = baseRes.status === "ok" ? readFileSync(baseRes.outputPath, "utf-8") : "";

    const coord = await runCoordination(
      { task: t.task, pool: t.pool }, { projectDir, vaultDir, outputDir },
    );

    rows.push({
      task: t.task,
      baseline: await judge(t.task, baseAnswer, t.reference, { run: judgeRun }),
      coord: await judge(t.task, coord.answer, t.reference, { run: judgeRun }),
    });
  }

  const s = summarize(rows);
  console.log(JSON.stringify({ rows, summary: s }, null, 2));
}

// Run only when invoked directly.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
```

- [ ] **Step 4: Seed the dataset**

Create `eval/tasks/ours.jsonl` with 5 real, gradeable tasks from our domain (code review with a known bug, an RCA with a known root cause, a refactor with a known dead-export, a TS type-safety fix, a SQL correctness fix). Each line:

```json
{"task": "Review src/lib/db.ts for connection-leak bugs and report file:line.", "reference": "The pool is created per-request and never closed; fix is a module-level singleton.", "pool": ["analyst", "coder", "reviewer"]}
```

(Add four more analogous lines covering RCA, refactor, TS, SQL.)

- [ ] **Step 5: Run test, then a live smoke eval**

Run: `npm test -- eval/run-eval.test.ts`
Expected: PASS (1 test).

Run (live, optional, needs agents): `npx tsx eval/run-eval.ts eval/tasks/ours.jsonl`
Expected: JSON report with `summary.coordMean >= summary.baselineMean` as the success bar; `wins` and per-row scores printed.

- [ ] **Step 6: Commit**

```bash
git add eval/run-eval.ts eval/run-eval.test.ts eval/tasks/ours.jsonl
git commit -m "feat(eval): baseline-vs-coordinator runner with judged scoring"
```

---

### Task 14: Public-benchmark adapter (LiveCodeBench-style)

**Files:**
- Create: `eval/public/livecodebench.ts`
- Test: `eval/public/livecodebench.test.ts`

**Interfaces:**
- Produces:
  - `extractCode(answer: string): string` — pull the final fenced code block from an answer.
  - `passAtOne(testResults: boolean[]): number` — 1 if all unit checks pass, else 0.
  - `toEvalTask(problem: { prompt: string; canonical: string }): EvalTask` — adapt a public problem into our `EvalTask` shape so `run-eval`/judge can score code by executing provided unit tests rather than the LLM-judge.

> This adapter makes the public-benchmark numbers apples-to-apples with Sakana (they report LiveCodeBench/GPQA). Code answers are graded by **executing the benchmark's own unit tests** (objective pass@1), NOT the LLM-judge. Wire actual dataset download + sandboxed execution as the live path; the unit test here covers the pure adapter logic only.

- [ ] **Step 1: Write the failing test**

```ts
// eval/public/livecodebench.test.ts
import { describe, it, expect } from "vitest";
import { extractCode, passAtOne } from "./livecodebench.js";

describe("livecodebench adapter", () => {
  it("extractCode returns the last fenced block body", () => {
    const a = "intro\n```python\nx=1\n```\nmid\n```python\nprint(42)\n```";
    expect(extractCode(a)).toBe("print(42)");
  });

  it("passAtOne is 1 only when all checks pass", () => {
    expect(passAtOne([true, true])).toBe(1);
    expect(passAtOne([true, false])).toBe(0);
    expect(passAtOne([])).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- eval/public/livecodebench.test.ts`
Expected: FAIL — `Cannot find module './livecodebench.js'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// eval/public/livecodebench.ts
import type { EvalTask } from "../run-eval.js";

export function extractCode(answer: string): string {
  const blocks = [...answer.matchAll(/```[a-zA-Z0-9]*\n([\s\S]*?)```/g)];
  if (blocks.length === 0) return answer.trim();
  return blocks[blocks.length - 1][1].trim();
}

export function passAtOne(testResults: boolean[]): number {
  return testResults.length > 0 && testResults.every(Boolean) ? 1 : 0;
}

export function toEvalTask(problem: { prompt: string; canonical: string }): EvalTask {
  return {
    task: problem.prompt,
    reference: problem.canonical,
    pool: ["analyst", "coder", "reviewer"],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- eval/public/livecodebench.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add eval/public/livecodebench.ts eval/public/livecodebench.test.ts
git commit -m "feat(eval): public-benchmark adapter (code extraction + pass@1)"
```

---

## Self-Review

**1. Spec coverage**
- Orchestrator over provider-agents → Tasks 1–10 (module + MCP tools). ✓
- Thinker/Worker/Verifier (TRINITY) → Tasks 2, 4. ✓
- Mixture-of-Agents → Task 7. ✓
- Reflexivo-now policy learning (CMA-ES/GRPO analog) → Tasks 5, 6, 9. ✓
- Shared knowledge base + agent-to-agent comms via `profiles.yaml` + Obsidian (user's mechanism) → Tasks 8, 10, 11. ✓
- Prove ≥ Sakana on our tasks + public benchmark → Tasks 12, 13, 14. ✓
- "GEPA depois" → deferred to the sequel plan (below), correctly out of this plan's scope. ✓

**2. Placeholder scan** — Every code step contains complete code; the only deliberately-light spots are the live dataset rows (Task 13 Step 4 gives one full example + a precise recipe for four more) and the live LiveCodeBench download/execution (Task 14 grades pure adapter logic, live path described). These are data/IO seams, not code placeholders.

**3. Type consistency** — `CoordinatorDeps` (Task 4) is reused verbatim by `moa.ts` (Task 7) and `runtime.ts` (Task 10). `Policy`/`PolicyRule` shape is identical across `types.ts`, `policy.ts`, `memory.ts`, `reflect.ts`. `EvalTask`/`EvalRow` consistent across Tasks 13–14. `spawnAgent` signature matches `src/spawner.ts:83`. `SpawnResult` matches `src/types.ts:55`.

**Risks / follow-ups**
- The exact `server.tool(...)` registration API must be copied from the existing `spawn_agent` in `src/index.ts` (Task 10 Step 4 flags this).
- The Obsidian MCP URL/port/token (Task 11) depend on the `mcp-tools-istefox` plugin running; the `--add-dir` + preamble path (Task 8) is the always-on fallback that needs no server.
- Live agent runs cost tokens/time; unit tests never spawn real processes.

---

## Sequel (separate plan): GEPA/DSPy programmatic optimization

Once this plan has produced a trace corpus with judged scores, a **second plan** introduces `dspy.GEPA` (reflective prompt evolution, ICLR 2026 — outperforms GRPO by up to 20% / MIPROv2 by 13% with 35× fewer rollouts) to optimize the role prompts and routing as a DSPy program over `eval/tasks/ours.jsonl` + the public adapters. That plan is Python (a new sibling repo), consumes this plan's traces and metric, and is gated on having ≥ ~50 judged traces. It is intentionally NOT in this plan because it is a different stack and subsystem.
