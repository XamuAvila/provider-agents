# Archon-over-OpenRouter Coordinator — Implementation Plan (v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build, inside the `provider-agents` package, an Archon-style inference-time pipeline that composes a diverse OpenRouter model pool into layered roles — Generator ensemble (+best-of-N) → Fuser (MoA) → Critic → Ranker → Verifier (multi-verifier voting for reasoning / unit-test execution for code) — and beats any single agent on our tasks and on public benchmarks. Phase 1 ships a fixed best-practice pipeline keyed by task category; Phase 2 (separate plan) adds Bayesian architecture search and a learned controller.

**Architecture:** A new `src/archon/` module. Each inference-time technique is a `Layer` that transforms a list of `Candidate`s. An `ArchitectureSpec` (declarative list of layer configs, chosen per task tag) is run by an `assemble()` executor that pipes candidates through the layers, spawning real provider-agents (DeepSeek/Kimi/diverse OpenRouter models) via the existing `spawnAgent`. Code answers are verified objectively by **generating and executing unit tests in a sandbox** (Archon's biggest lever: +56% Pass@1). Reasoning answers are verified by a **multi-verifier vote**. Every run logs a trace to the Obsidian vault for the Phase-2 search to consume.

**Tech Stack:** TypeScript (ESM), Node ≥20, `@modelcontextprotocol/server`, `js-yaml`, `zod`, Vitest, tsup. Reuses `src/spawner.ts` (`spawnAgent`), `src/config.ts` (`loadMergedConfig`). Sandboxed code execution via `node:child_process` against a temp dir with a hard timeout (no network).

## Global Constraints

- Package root: `/home/samuel/Documentos/pessoal/provider-agents` — all `src/**` paths relative to it.
- Profiles file (shared, NOT a git repo — edit files, do NOT `git commit` there): `/home/samuel/Documentos/blis/repos/deepclaude/.claude/profiles.yaml`.
- Vault root (env `PROVIDER_AGENTS_VAULT`, default `/home/samuel/Documentos/Obsidian Vault`).
- ESM relative imports MUST use the `.js` extension.
- Immutability: never mutate inputs; return new objects.
- Only `claude-p` profiles accept `mcp_config`; `cli`/OpenRouter profiles get context via prompt or `--add-dir`.
- Sandbox: executed code runs in a fresh temp dir, hard wall-clock timeout, killed process tree, NEVER the repo working tree; never execute code with network access; never log secrets.
- Empirical layer rules from Archon (arxiv 2409.15254) are the Phase-1 defaults: **code → unit-test exec**, **reasoning → verifier vote**, **instruction → ranker+critic**. Generators ordered best→worst; more generators help monotonically.
- Honest guardrails (from 2604.02460, 2502.20379): multi-agent is NOT always better than a single strong agent at equal budget; verifiers are imperfect (false positives → diminishing returns). The pipeline MUST be eval-gated and budget-aware — a trivial task routes to a single generator.
- Tests use Vitest with dependency-injected spawn/exec — NO real agent processes or real code execution in unit tests.
- Run `npm run typecheck` and `npm test` green before every commit. Commit messages append:
  `Co-Authored-By: samuel-avila-blis <samuel.avila@blisai.com>` and `Claude-Session: https://claude.ai/code/session_01CTUi2ga1iUAY8AndtiNdhr`.

---

## File Structure

`src/archon/`:
- `types.ts` — `Role`, `Verdict`, `Turn`, `Trace`, `Policy` (FOUNDATION — **Task 1, DONE**) + Archon types `Candidate`, `LayerKind`, `LayerConfig`, `ArchitectureSpec`, `EngineDeps`.
- `roles.ts` — role/layer prompt templates + verdict parsing (Task 2).
- `memory.ts` — Obsidian trace/policy read+write (Task 3).
- `trace.ts` — trace builder + task tagging → drives best-practice spec selection (Task 4).
- `layers/generator.ts` — ensemble + best-of-N (Task 6).
- `layers/fuser.ts` — MoA synthesis (Task 7).
- `layers/critic.ts` + `layers/ranker.ts` — critique then rank top-K (Task 8).
- `layers/verifier.ts` — multi-verifier vote for reasoning (Task 9).
- `layers/unittest.ts` — unit-test generation + sandboxed execution for code (Task 10).
- `sandbox.ts` — safe code runner used by `unittest.ts` (Task 10).
- `assemble.ts` — run an `ArchitectureSpec` over the pool; best-practice specs per tag (Task 11).
- `runtime.ts` + `index.ts` — adapters + barrel; MCP tool `archon_run` (Task 12).
- `*.test.ts` — colocated Vitest tests.

Modified: `src/index.ts` (register `archon_run`). Config: `deepclaude/.claude/profiles.yaml` (diverse generator pool — Task 5).

Eval: `eval/judge.ts`, `eval/run-eval.ts`, `eval/exec-grade.ts`, `eval/tasks/ours.jsonl` (Task 13).

> **Phase 2 (separate plan):** Bayesian architecture search over `{#generators, samples, fusion layers, verifier on/off, unittest on/off}` against the eval set per task tag, plus a learned controller that loads the winning `ArchitectureSpec` per tag from Obsidian and GEPA-reflects on traces. Out of scope here; this plan ships the fixed best-practice pipeline that GENERATES the traces Phase 2 needs.

---

## Phase 0 — Foundation

### Task 1: Coordinator/Archon types — **DONE** (commit `dde3dc7`)

`src/archon/types.ts` already exists with `ROLES`, `Role`, `isRole`, `Verdict`, `Turn`, `CoordinationRequest`, `CoordinationResult`, `PolicyRule`, `Policy`, `Trace`, `EMPTY_POLICY` (built as `src/coordinator/types.ts`; **the implementer of Task 2 MUST move/rename the existing `src/coordinator/` directory to `src/archon/`** as its first step — `git mv src/coordinator src/archon`, then update the import paths in the moved test, run `npm test`, and commit that rename before starting Task 2's own work).

- [ ] **Step 0 (Task 2 implementer does this):** `git mv src/coordinator src/archon` and fix imports; `npm test` green; commit `refactor: rename coordinator module to archon`.

### Task 2: Layer prompts & verdict parsing

**Files:** Modify `src/archon/roles.ts` (created during the prior plan as `coordinator/roles.ts`; if absent, create it); Test `src/archon/roles.test.ts`.

**Interfaces:**
- Consumes: `Role`, `Turn`, `Verdict` from `./types.js`.
- Produces: `buildRolePrompt(role, task, transcript)`, `parseVerdict(output)`, plus Archon layer prompts `criticPrompt(task, candidates)`, `rankerPrompt(task, candidates, critiques)`, `fuserPrompt(task, candidates)`, `verifierPrompt(task, candidate)`, `unitTestPrompt(task)`.

- [ ] **Step 1: Write the failing test**

```ts
// src/archon/roles.test.ts
import { describe, it, expect } from "vitest";
import { parseVerdict, fuserPrompt, criticPrompt, verifierPrompt, unitTestPrompt } from "./roles.js";

describe("archon prompts", () => {
  it("parseVerdict reads the last verdict, default REVISE", () => {
    expect(parseVerdict("ok ACCEPT")).toBe("ACCEPT");
    expect(parseVerdict("bad REVISE")).toBe("REVISE");
    expect(parseVerdict("none")).toBe("REVISE");
  });
  it("fuserPrompt lists every candidate", () => {
    const p = fuserPrompt("T", [{ id: "a", text: "C1", fromProfile: "x" }, { id: "b", text: "C2", fromProfile: "y" }]);
    expect(p).toContain("C1"); expect(p).toContain("C2"); expect(p).toContain("T");
  });
  it("criticPrompt asks for strengths and weaknesses", () => {
    const p = criticPrompt("T", [{ id: "a", text: "C1", fromProfile: "x" }]);
    expect(p.toLowerCase()).toContain("strength"); expect(p.toLowerCase()).toContain("weakness");
  });
  it("verifierPrompt demands ACCEPT/REVISE", () => {
    const p = verifierPrompt("T", { id: "a", text: "C", fromProfile: "x" });
    expect(p).toContain("ACCEPT"); expect(p).toContain("REVISE");
  });
  it("unitTestPrompt asks for a fenced test block", () => {
    expect(unitTestPrompt("write add()").toLowerCase()).toContain("unit test");
  });
});
```

- [ ] **Step 2: Run test (FAIL — missing exports).** Run: `npm test -- src/archon/roles.test.ts`

- [ ] **Step 3: Implement** (`src/archon/roles.ts`)

```ts
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
```

- [ ] **Step 4: Run test (PASS).** `npm test -- src/archon/roles.test.ts`
- [ ] **Step 5: Commit** `feat(archon): layer prompts (fuser/critic/ranker/verifier/unittest) and verdict parsing`

### Task 3: Obsidian memory (trace + policy)

Carry over the memory module from the prior plan verbatim, in `src/archon/memory.ts` with `resolveVaultDir`, `writeTrace`, `readRecentTraces`, `readPolicy`, `writePolicy` and tests (round-trip a trace; newest-first; empty-policy default). **(Full code: see prior plan version in git history of this file; the implementer reuses it unchanged, only the import path is `./types.js` under `src/archon/`.)**

- [ ] Steps: failing test → implement (markdown+frontmatter serialization to `<vault>/coordinator/traces/<id>.md` and `<vault>/coordinator/policy.md`) → pass → commit `feat(archon): Obsidian trace and policy persistence`.

### Task 4: Trace builder + task tagging

`src/archon/trace.ts`: `deriveTags(task)` → `["typescript"|"python"|"sql"|"security"|"reasoning"|"code"|"general", ...]`, `buildTrace(task, result, createdAt)`. Tags drive best-practice spec selection in Task 11 (code-ish tags → unit-test pipeline; reasoning → verifier pipeline). Failing test (tags + build) → implement → pass → commit `feat(archon): trace builder with task tagging`.

---

## Phase 1 — The Archon best-practice pipeline

### Task 5: Diverse OpenRouter generator pool (profiles)

**Files (edit, NO git commit — deepclaude is not a repo):** `/home/samuel/Documentos/blis/repos/deepclaude/.claude/profiles.yaml`.

**Interfaces:** Produces profile names the generator ensemble routes to. Add a curated diverse set of OpenRouter `:free` + paid models as `cli` profiles using the existing `openrouter-agent` wrapper, ordered best→worst per Archon guidance.

- [ ] **Step 1:** Append generator profiles (mirror the existing `openrouter-*` shape at `profiles.yaml:529-632`). Curate ~8 DIVERSE models (different families → diversity is the fuel): keep `openrouter-coder` (nex-n2-pro), `openrouter-reviewer` (laguna-m.1), `openrouter-reasoning` (nemotron-550b), and add e.g. `gen-qwen` (`qwen/qwen3.5-coder:free` or current), `gen-llama` (`meta-llama/llama-4-maverick:free`), `gen-deepseek-free` (`deepseek/deepseek-r1:free`), `gen-glm` (`z-ai/glm-4.6:free`), `gen-mistral` (`mistralai/...:free`). Each:

```yaml
  gen-qwen:
    invocation: cli
    command: openrouter-agent
    model: qwen/qwen3.5-coder:free
    stdin: false
    tags: [generator, free, code]
    system_prompt: |-
      You are a GENERATOR. Produce your single best, complete, independent solution to the task.
      Respond in Portuguese (pt-BR); code/identifiers in English. Never log secrets.
    args: [--raw, --no-thinking-stdout]
    timeout: 300
    description: Generator FREE (Qwen3.5 Coder). Diverse ensemble member.
```

> The implementer MUST verify each model id exists on OpenRouter today (`openrouter-agent --help` / the OpenRouter models list) and is `:free`; substitute the closest current `:free` model if an id is stale, and record the final list in the report. Do NOT invent model ids.

- [ ] **Step 2: Validate parse** `bash /home/samuel/Documentos/blis/repos/deepclaude/scripts/spawn.sh` → list includes the new `gen-*` profiles, no YAML error.
- [ ] **Step 3:** No git commit (not a repo). Record the final curated pool in the task report.

### Task 6: Generator layer (ensemble + best-of-N)

**Files:** Create `src/archon/layers/generator.ts`; Test `src/archon/layers/generator.test.ts`.

**Interfaces:**
- Consumes: `Candidate`, `EngineDeps` from `../types.js`.
- Produces: `generate(task: string, profiles: string[], samples: number, deps: EngineDeps): Promise<Candidate[]>` — spawns each (profile × sample) concurrently; one `Candidate` per non-empty output, `id = "<profile>#<sample>"`.

First add to `src/archon/types.ts` (Task 6 implementer extends it):
```ts
export interface Candidate { id: string; text: string; fromProfile: string; score?: number; critique?: string; }
export type LayerKind = "generator" | "fuser" | "critic" | "ranker" | "verifier" | "unittest";
export interface LayerConfig { kind: LayerKind; profiles?: string[]; samples?: number; topK?: number; }
export interface ArchitectureSpec { name: string; layers: LayerConfig[]; }
export interface EngineDeps {
  spawn: (profile: string, prompt: string, outputPath: string, cwd?: string) => Promise<import("../../types.js").SpawnResult>;
  readOutput: (path: string) => string;
  outputPathFor: (label: string) => string;
}
```

- [ ] **Step 1: Failing test**
```ts
// src/archon/layers/generator.test.ts
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
```
- [ ] **Step 2: FAIL.** `npm test -- src/archon/layers/generator.test.ts`
- [ ] **Step 3: Implement**
```ts
// src/archon/layers/generator.ts
import type { Candidate, EngineDeps } from "../types.js";

const GEN_BRIEF = "Produce your single best, complete, independent solution to the task.";

export async function generate(
  task: string, profiles: string[], samples: number, deps: EngineDeps,
): Promise<Candidate[]> {
  const jobs: Promise<Candidate | null>[] = [];
  for (const profile of profiles) {
    for (let s = 0; s < samples; s++) {
      const id = `${profile}#${s}`;
      const outputPath = deps.outputPathFor(id);
      jobs.push(
        deps.spawn(profile, `${GEN_BRIEF}\n\n## Task\n${task}`, outputPath).then((r) => {
          const text = r.status === "ok" ? deps.readOutput(r.outputPath).trim() : "";
          return text ? { id, text, fromProfile: profile } : null;
        }),
      );
    }
  }
  const settled = await Promise.all(jobs);
  return settled.filter((c): c is Candidate => c !== null);
}
```
- [ ] **Step 4: PASS.** **Step 5: Commit** `feat(archon): generator layer (ensemble + best-of-N)`

### Task 7: Fuser layer (MoA)

**Files:** Create `src/archon/layers/fuser.ts` + test.
**Interfaces:** `fuse(task, candidates, fuserProfile, deps): Promise<Candidate>` — one spawn; returns a single fused candidate (`id="fused"`).

- [ ] **Step 1: Failing test** (one candidate out; aggregator sees all inputs)
```ts
import { describe, it, expect, vi } from "vitest";
import { fuse } from "./fuser.js";
import type { EngineDeps } from "../types.js";
import type { SpawnResult } from "../../types.js";
const deps = (out: string): EngineDeps => ({
  spawn: vi.fn(async (p: string, _pr: string, outputPath: string): Promise<SpawnResult> => ({ status:"ok", exitCode:0, outputPath, profile:p, model:"m", durationMs:1 })),
  readOutput: () => out, outputPathFor: (l) => `/out/${l}`,
});
describe("fuse", () => {
  it("returns a single fused candidate", async () => {
    const c = await fuse("t", [{ id:"a", text:"A", fromProfile:"x" }, { id:"b", text:"B", fromProfile:"y" }], "aggregator", deps("FUSED"));
    expect(c.id).toBe("fused"); expect(c.text).toBe("FUSED"); expect(c.fromProfile).toBe("aggregator");
  });
});
```
- [ ] **Step 2-4:** FAIL → implement → PASS
```ts
// src/archon/layers/fuser.ts
import type { Candidate, EngineDeps } from "../types.js";
import { fuserPrompt } from "../roles.js";
export async function fuse(
  task: string, candidates: Candidate[], fuserProfile: string, deps: EngineDeps,
): Promise<Candidate> {
  const outputPath = deps.outputPathFor("fused");
  const r = await deps.spawn(fuserProfile, fuserPrompt(task, candidates), outputPath);
  const text = r.status === "ok" ? deps.readOutput(r.outputPath).trim() : "";
  return { id: "fused", text, fromProfile: fuserProfile };
}
```
- [ ] **Step 5: Commit** `feat(archon): fuser layer (mixture-of-agents synthesis)`

### Task 8: Critic + Ranker layers

**Files:** Create `src/archon/layers/critic.ts`, `src/archon/layers/ranker.ts` + tests.
**Interfaces:** `critique(task, candidates, criticProfile, deps): Promise<Candidate[]>` (returns candidates with `.critique` filled); `rank(task, candidates, rankerProfile, topK, deps): Promise<Candidate[]>` (reorders by parsed id list, returns top-K; falls back to input order if parse fails). Add `parseIdRanking(raw, validIds): string[]`.

- [ ] **Step 1: Failing tests** (critic annotates; ranker reorders + topK; parse fallback)
```ts
// ranker.test.ts excerpt
import { parseIdRanking } from "./ranker.js";
it("parses a fenced json id array, keeping only valid ids", () => {
  expect(parseIdRanking('```json\n["b","z","a"]\n```', ["a","b"])).toEqual(["b","a"]);
  expect(parseIdRanking("garbage", ["a","b"])).toEqual([]);
});
```
- [ ] **Step 3: Implement**
```ts
// src/archon/layers/critic.ts
import type { Candidate, EngineDeps } from "../types.js";
import { criticPrompt } from "../roles.js";
export async function critique(task: string, candidates: Candidate[], criticProfile: string, deps: EngineDeps): Promise<Candidate[]> {
  if (candidates.length === 0) return candidates;
  const r = await deps.spawn(criticProfile, criticPrompt(task, candidates), deps.outputPathFor("critic"));
  const text = r.status === "ok" ? deps.readOutput(r.outputPath) : "";
  return candidates.map((c) => {
    const line = text.split("\n").find((l) => l.includes(`id=${c.id}`));
    return line ? { ...c, critique: line.trim() } : c;
  });
}
```
```ts
// src/archon/layers/ranker.ts
import type { Candidate, EngineDeps } from "../types.js";
import { rankerPrompt } from "../roles.js";
export function parseIdRanking(raw: string, validIds: string[]): string[] {
  const m = raw.match(/```json\s*([\s\S]*?)```/);
  try {
    const arr = JSON.parse(m ? m[1] : raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.map(String).filter((id) => validIds.includes(id));
  } catch { return []; }
}
export async function rank(task: string, candidates: Candidate[], rankerProfile: string, topK: number, deps: EngineDeps): Promise<Candidate[]> {
  if (candidates.length <= 1) return candidates.slice(0, topK);
  const critiques = candidates.map((c) => c.critique ?? "").join("\n");
  const r = await deps.spawn(rankerProfile, rankerPrompt(task, candidates, critiques), deps.outputPathFor("ranker"));
  const raw = r.status === "ok" ? deps.readOutput(r.outputPath) : "";
  const order = parseIdRanking(raw, candidates.map((c) => c.id));
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const ranked = order.map((id) => byId.get(id)!).filter(Boolean);
  const rest = candidates.filter((c) => !order.includes(c.id));
  return [...ranked, ...rest].slice(0, topK);
}
```
- [ ] **Steps 2/4/5:** FAIL → PASS → Commit `feat(archon): critic and ranker layers`

### Task 9: Verifier layer (multi-verifier vote)

**Files:** Create `src/archon/layers/verifier.ts` + test.
**Interfaces:** `verifyVote(task, candidate, verifierProfiles, deps): Promise<{ accepted: boolean; votes: Verdict[] }>` — spawn each verifier concurrently, ACCEPT iff majority ACCEPT (fail-closed on ties). `verifyBest(task, candidates, verifierProfiles, deps): Promise<Candidate>` — return the first candidate that passes the vote, else the first candidate.

- [ ] **Step 1: Failing test**
```ts
import { describe, it, expect, vi } from "vitest";
import { verifyVote } from "./verifier.js";
import type { EngineDeps } from "../types.js";
import type { SpawnResult } from "../../types.js";
function deps(outs: string[]): EngineDeps {
  const q = [...outs];
  return { spawn: vi.fn(async (p:string,_x:string,outputPath:string):Promise<SpawnResult>=>({status:"ok",exitCode:0,outputPath,profile:p,model:"m",durationMs:1})),
    readOutput: () => q.shift() ?? "REVISE", outputPathFor:(l)=>`/out/${l}` };
}
describe("verifyVote", () => {
  it("accepts on majority ACCEPT, fails closed on tie", async () => {
    expect((await verifyVote("t",{id:"a",text:"A",fromProfile:"x"},["v1","v2","v3"],deps(["ACCEPT","ACCEPT","REVISE"]))).accepted).toBe(true);
    expect((await verifyVote("t",{id:"a",text:"A",fromProfile:"x"},["v1","v2"],deps(["ACCEPT","REVISE"]))).accepted).toBe(false);
  });
});
```
- [ ] **Step 3: Implement**
```ts
// src/archon/layers/verifier.ts
import type { Candidate, EngineDeps, Verdict } from "../types.js";
import { verifierPrompt, parseVerdict } from "../roles.js";
export async function verifyVote(task: string, c: Candidate, verifierProfiles: string[], deps: EngineDeps): Promise<{ accepted: boolean; votes: Verdict[] }> {
  const votes = await Promise.all(verifierProfiles.map(async (vp, i) => {
    const r = await deps.spawn(vp, verifierPrompt(task, c), deps.outputPathFor(`verifier-${c.id}-${i}`));
    return parseVerdict(r.status === "ok" ? deps.readOutput(r.outputPath) : "REVISE");
  }));
  const accept = votes.filter((v) => v === "ACCEPT").length;
  return { accepted: accept * 2 > votes.length, votes };
}
export async function verifyBest(task: string, candidates: Candidate[], verifierProfiles: string[], deps: EngineDeps): Promise<Candidate> {
  for (const c of candidates) {
    const { accepted } = await verifyVote(task, c, verifierProfiles, deps);
    if (accepted) return c;
  }
  return candidates[0];
}
```
- [ ] **Steps 2/4/5:** FAIL → PASS → Commit `feat(archon): multi-verifier voting layer`

### Task 10: Unit-test layer + sandbox (the code lever, +56%)

**Files:** Create `src/archon/sandbox.ts`, `src/archon/layers/unittest.ts` + tests.
**Interfaces:**
- `extractCode(text): string` — last fenced block body.
- `runInSandbox(files: Record<string,string>, cmd: string[], timeoutMs: number): Promise<{ ok: boolean; output: string }>` — write files to a fresh temp dir, run `cmd` with cwd=tempdir, no network env, hard timeout, kill tree, always cleanup.
- `unitTestRank(task, candidates, testGenProfile, lang, deps, runner): Promise<Candidate[]>` — generate tests once, execute each candidate's code against them, set `c.score` = pass(1)/fail(0), return candidates sorted by score desc. `runner` is injected (DI) so unit tests don't execute real code.

- [ ] **Step 1: Failing tests** (sandbox is integration-tested separately/lightly; unitTestRank uses an injected fake runner)
```ts
// src/archon/layers/unittest.test.ts
import { describe, it, expect, vi } from "vitest";
import { extractCode, unitTestRank } from "./unittest.js";
import type { EngineDeps } from "../types.js";
import type { SpawnResult } from "../../types.js";
describe("unittest layer", () => {
  it("extractCode returns the last fenced block", () => {
    expect(extractCode("```py\nx=1\n```\n```py\nprint(2)\n```")).toBe("print(2)");
  });
  it("ranks candidates by injected runner pass/fail", async () => {
    const deps: EngineDeps = {
      spawn: vi.fn(async (p:string,_x:string,outputPath:string):Promise<SpawnResult>=>({status:"ok",exitCode:0,outputPath,profile:p,model:"m",durationMs:1})),
      readOutput: () => "```python\n# tests\n```", outputPathFor:(l)=>`/out/${l}`,
    };
    const runner = vi.fn(async (_f:Record<string,string>) => ({ ok: false, output: "" }));
    runner.mockResolvedValueOnce({ ok: true, output: "" }); // first candidate passes
    const cs = [{ id:"a", text:"```python\ncodeA\n```", fromProfile:"x" }, { id:"b", text:"```python\ncodeB\n```", fromProfile:"y" }];
    const ranked = await unitTestRank("t", cs, "tester", "python", deps, runner);
    expect(ranked[0].id).toBe("a"); expect(ranked[0].score).toBe(1); expect(ranked[1].score).toBe(0);
  });
});
```
- [ ] **Step 3: Implement**
```ts
// src/archon/sandbox.ts
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
export async function runInSandbox(files: Record<string, string>, cmd: string[], timeoutMs: number): Promise<{ ok: boolean; output: string }> {
  const dir = mkdtempSync(join(tmpdir(), "archon-sbx-"));
  try {
    for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content, "utf-8");
    return await new Promise((resolve) => {
      const child = spawn(cmd[0], cmd.slice(1), { cwd: dir, env: { PATH: process.env.PATH ?? "", HOME: dir }, stdio: ["ignore", "pipe", "pipe"] });
      let out = ""; const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
      child.stdout.on("data", (d) => (out += d)); child.stderr.on("data", (d) => (out += d));
      child.on("close", (code) => { clearTimeout(timer); resolve({ ok: code === 0, output: out }); });
      child.on("error", (e) => { clearTimeout(timer); resolve({ ok: false, output: String(e) }); });
    });
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
```
```ts
// src/archon/layers/unittest.ts
import type { Candidate, EngineDeps } from "../types.js";
import { unitTestPrompt } from "../roles.js";
import { runInSandbox } from "../sandbox.js";
export function extractCode(text: string): string {
  const blocks = [...text.matchAll(/```[a-zA-Z0-9]*\n([\s\S]*?)```/g)];
  return blocks.length ? blocks[blocks.length - 1][1].trim() : text.trim();
}
const RUN: Record<string, { test: string; sol: string; cmd: string[] }> = {
  python: { test: "test_main.py", sol: "solution.py", cmd: ["python3", "-m", "pytest", "-q", "test_main.py"] },
};
export type Runner = (files: Record<string, string>) => Promise<{ ok: boolean; output: string }>;
export async function unitTestRank(
  task: string, candidates: Candidate[], testGenProfile: string, lang: string, deps: EngineDeps, runner: Runner = (f) => runInSandbox(f, RUN[lang].cmd, 20000),
): Promise<Candidate[]> {
  const cfg = RUN[lang];
  if (!cfg || candidates.length === 0) return candidates;
  const tg = await deps.spawn(testGenProfile, unitTestPrompt(task), deps.outputPathFor("unittest-gen"));
  const tests = extractCode(tg.status === "ok" ? deps.readOutput(tg.outputPath) : "");
  const scored = await Promise.all(candidates.map(async (c) => {
    const { ok } = await runner({ [cfg.sol]: extractCode(c.text), [cfg.test]: tests });
    return { ...c, score: ok ? 1 : 0 };
  }));
  return [...scored].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}
```
- [ ] **Steps 2/4:** FAIL → PASS. **Step 5: Commit** `feat(archon): unit-test generation + sandboxed execution ranking`

### Task 11: Pipeline assembler + best-practice specs

**Files:** Create `src/archon/assemble.ts` + test.
**Interfaces:**
- `bestPracticeSpec(tags: string[]): ArchitectureSpec` — Archon's empirical defaults: code tags → generator(ensemble)→fuser→unittest; reasoning → generator→fuser→critic→ranker→verifier; general/instruction → generator→critic→ranker→fuser; trivial → single generator.
- `assemble(task, tags, spec, deps, pools): Promise<{ answer: string; candidates: Candidate[] }>` — run layers in order; `pools` supplies profile lists per role.

- [ ] **Step 1: Failing test** (spec selection by tag; assemble pipes layers, DI'd layer fns)
```ts
// src/archon/assemble.test.ts
import { describe, it, expect } from "vitest";
import { bestPracticeSpec } from "./assemble.js";
describe("bestPracticeSpec", () => {
  it("code tasks include a unittest layer", () => {
    expect(bestPracticeSpec(["python","code"]).layers.map(l=>l.kind)).toContain("unittest");
  });
  it("reasoning tasks include a verifier layer", () => {
    expect(bestPracticeSpec(["reasoning"]).layers.map(l=>l.kind)).toContain("verifier");
  });
  it("general tasks use ranker+fuser, no unittest", () => {
    const k = bestPracticeSpec(["general"]).layers.map(l=>l.kind);
    expect(k).toContain("ranker"); expect(k).not.toContain("unittest");
  });
});
```
- [ ] **Step 3: Implement** (selection logic + a thin executor that dispatches each layer to the Task 6-10 functions; pools default to the Task 5 profiles)
```ts
// src/archon/assemble.ts
import type { ArchitectureSpec, Candidate, EngineDeps } from "./types.js";
import { generate } from "./layers/generator.js";
import { fuse } from "./layers/fuser.js";
import { critique } from "./layers/critic.js";
import { rank } from "./layers/ranker.js";
import { verifyBest } from "./layers/verifier.js";
import { unitTestRank } from "./layers/unittest.js";

export interface Pools { generators: string[]; fuser: string; critic: string; ranker: string; verifiers: string[]; tester: string; }

const isCode = (tags: string[]) => tags.some((t) => ["code","python","typescript","javascript","csharp","sql"].includes(t));
const isReasoning = (tags: string[]) => tags.includes("reasoning");

export function bestPracticeSpec(tags: string[]): ArchitectureSpec {
  if (isCode(tags)) return { name: "code", layers: [ {kind:"generator",samples:1}, {kind:"fuser"}, {kind:"unittest"} ] };
  if (isReasoning(tags)) return { name: "reasoning", layers: [ {kind:"generator",samples:2}, {kind:"fuser"}, {kind:"critic"}, {kind:"ranker",topK:3}, {kind:"verifier"} ] };
  return { name: "general", layers: [ {kind:"generator",samples:1}, {kind:"critic"}, {kind:"ranker",topK:3}, {kind:"fuser"} ] };
}

export async function assemble(
  task: string, tags: string[], spec: ArchitectureSpec, deps: EngineDeps, pools: Pools, lang = "python",
): Promise<{ answer: string; candidates: Candidate[] }> {
  let candidates: Candidate[] = [];
  for (const layer of spec.layers) {
    switch (layer.kind) {
      case "generator": candidates = await generate(task, layer.profiles ?? pools.generators, layer.samples ?? 1, deps); break;
      case "fuser": candidates = [await fuse(task, candidates, pools.fuser, deps)]; break;
      case "critic": candidates = await critique(task, candidates, pools.critic, deps); break;
      case "ranker": candidates = await rank(task, candidates, pools.ranker, layer.topK ?? 3, deps); break;
      case "verifier": candidates = [await verifyBest(task, candidates, pools.verifiers, deps)]; break;
      case "unittest": candidates = await unitTestRank(task, candidates, pools.tester, lang, deps); break;
    }
    if (candidates.length === 0) break;
  }
  return { answer: candidates[0]?.text ?? "", candidates };
}
```
- [ ] **Steps 2/4/5:** FAIL → PASS → Commit `feat(archon): pipeline assembler + best-practice specs per task tag`

### Task 12: Runtime adapters + `archon_run` MCP tool

**Files:** Create `src/archon/runtime.ts`, `src/archon/index.ts`; Modify `src/index.ts`; Test `src/archon/runtime.test.ts`.
**Interfaces:** `makeEngineDeps(opts)` binds real `spawnAgent`/file IO (output written to a file, read back) + injects KB policy preamble; `runArchon(task, opts): Promise<{answer; spec; traceId}>` → `deriveTags` → `bestPracticeSpec` → `assemble` → `writeTrace`. Register `archon_run` using the repo's real API `server.registerTool(name, {title, description, inputSchema: z.object({...})}, handler)` (verified at `src/index.ts:165`, `z` is `import * as z from "zod"`, content items `type: "text" as const`).

- [ ] **Step 1: Failing test** (deps adapter: outputPathFor unique; runArchon wires tags→spec) → **Step 3: Implement** (mirror `spawn_agent` registration; default pools from Task 5 profile names) → **Step 5: Commit** `feat(archon): runtime adapters + archon_run MCP tool`. Run `npm run typecheck && npm test && npm run build` green before commit.

### Task 13: Eval — HumanEval (famous public greenfield benchmark), single-agent baseline vs Archon

**Why HumanEval:** the canonical public **greenfield** code-generation benchmark — 164 standalone problems, each a function signature + docstring → write the whole function from scratch, graded by executing hidden canonical unit tests. It is exactly Archon's biggest lever (code → unit-test execution, reported +56% Pass@1) and lets us compare against published numbers. **The Archon pipeline NEVER sees the hidden canonical test** — it selects among candidates using its OWN generated tests (Task 10 `unitTestRank`); the canonical test is used only by `gradeHumanEval` to compute the reported Pass@1. MIT-licensed (openai/human-eval), grading needs only plain `python3` (the `test` field defines `check(candidate)` with asserts — no pytest).

**Files:**
- Create `eval/humaneval.ts` — loader + grader + Pass@1 aggregator.
- Create `eval/fetch-humaneval.ts` — one-shot downloader of the official dataset → `eval/tasks/humaneval.jsonl` (NOT run during eval; network allowed here — this is the harness, not sandboxed candidate code).
- Create `eval/tasks/humaneval-subset.jsonl` — fixed ≥20-problem subset (seeded order), committed for reproducibility.
- Create `eval/run-eval.ts` — baseline vs Archon over the subset; prints both Pass@1 numbers.
- Test: `eval/humaneval.test.ts`.
- Add `eval/**/*.test.ts` to `vitest.config.ts` include if needed.

**Interfaces:**
- `type HumanEvalProblem = { taskId: string; prompt: string; entryPoint: string; test: string; canonicalSolution: string }`
- `loadHumanEval(path: string): HumanEvalProblem[]` — parse JSONL, map snake_case fields (`task_id`,`entry_point`,`canonical_solution`) → camelCase.
- `extractCompletion(modelText: string): string` — strip markdown fences; return the body to append after `problem.prompt` (reuse `extractCode` from `src/archon/layers/unittest.ts`).
- `gradeHumanEval(problem, completion, runner?)` — assemble `prompt + completion + test + check(entryPoint)` and run via the Task 10 sandbox.
- `passAt1(problems, solve, deps): Promise<{ mean: number; passed: number; n: number; perTask: { taskId: string; passed: boolean }[] }>` where `solve(problem) => Promise<string /*completion*/>`.
- `main()` builds the baseline solver (single strongest generator profile → one completion) and the Archon solver (`runArchon` with the code/unit-test spec from Task 11, returns the best candidate's completion), runs both over the subset, prints `{ baselinePass1, archonPass1, delta, n }`.

**Grader (the crux — reuses Task 10 `runInSandbox` signature `(files, cmd, timeoutMs) => {ok,output}`):**
```ts
// eval/humaneval.ts
import { runInSandbox } from "../src/archon/sandbox.js";
export type SandboxRunner = (files: Record<string, string>, cmd: string[], timeoutMs: number) => Promise<{ ok: boolean; output: string }>;
export async function gradeHumanEval(
  problem: HumanEvalProblem,
  completion: string,
  runner: SandboxRunner = runInSandbox,
): Promise<{ passed: boolean; output: string }> {
  // HumanEval grades prompt + completion + test + a call to check(entry_point).
  const program =
    problem.prompt + completion + "\n\n" + problem.test +
    "\n\ncheck(" + problem.entryPoint + ")\n";
  const { ok, output } = await runner({ "prog.py": program }, ["python3", "prog.py"], 10_000);
  return { passed: ok, output: output.slice(0, 2000) };
}
```

**Honest setup (encode in `run-eval.ts`):**
- Baseline solver: single strongest generator profile → one completion → `gradeHumanEval`.
- Archon solver: generator ensemble (≥3 diverse profiles, Task 6) → `unitTestRank` (Task 10) generates tests, runs each candidate against them in the sandbox, returns the best-passing candidate's completion → `gradeHumanEval` on the hidden canonical test.
- Subset: fixed 20+ problems (seeded order). `log()` the subset size and that it IS a subset — no silent truncation.

**Success bar (REQUIRED by the project goal):** over the subset, `archonPass1 >= baselinePass1` AND `archonPass1 > 0`; report exact counts (`passed/n`). If `python3` is absent, the harness prints a clear SKIPPED message and exits non-zero — never a fake pass.

- [ ] Steps: failing unit tests (`loadHumanEval` maps fields; `extractCompletion` strips fences; `gradeHumanEval` PASSES a known-good canonical solution and FAILS a known-bad one via a stub runner; `passAt1` aggregates) → implement → pass → `npx tsx eval/fetch-humaneval.ts` then commit the 20-problem subset → live run `npx tsx eval/run-eval.ts` showing both Pass@1 numbers → commit `feat(eval): HumanEval greenfield benchmark, single-agent baseline vs Archon pipeline`.

---

## Self-Review

**Spec coverage:** Diverse OpenRouter pool (T5) · generator+best-of-N (T6) · fuser/MoA (T7) · critic+ranker (T8) · multi-verifier vote (T9) · unit-test execution, the +56% lever (T10) · per-tag best-practice assembler (T11) · MCP tool (T12) · **HumanEval** greenfield eval (T13) proving Archon Pass@1 ≥ single-agent baseline on a famous public benchmark. Foundation reused (T1 done, T2–T4). ✓

**Honest guardrails encoded:** trivial→single generator (budget-aware, per 2604.02460); multi-verifier vote (imperfect-verifier mitigation, 2502.20379); per-tag specs (no-transfer, Archon); execution grounding for code (objective signal). ✓

**Type consistency:** `Candidate`/`EngineDeps`/`ArchitectureSpec`/`Pools` shared from `src/archon/types.ts`; layer fns all `(task, candidates, profile(s), deps)`; `spawn`/`SpawnResult` match `src/spawner.ts:83`/`src/types.ts:55`. ✓

**Risks:** OpenRouter model ids drift (T5 mandates live verification, no invented ids); sandbox requires `python3` present — T10 `unitTestRank` also needs `pytest`; **T13 HumanEval needs only plain `python3`** (canonical `check()` asserts); the implementer notes if absent and gates the live path (SKIPPED + non-zero exit, never a fake pass); `assemble` layer set is fixed best-practice (Phase 2 search replaces the hand-picked specs).

## Phase 2 (separate plan): Bayesian architecture search + learned controller

Once Phase 1 generates judged traces, a second plan adds: Bayesian optimization over `{#generators, samples, fusion layers, verifier on/off, unittest on/off, topK}` evaluated on a 20% eval sample per task tag (Archon: Bayesian beat greedy/random in 95.2% of cases); a controller that loads the winning `ArchitectureSpec` per tag from Obsidian; and GEPA reflective evolution of layer prompts. Gated on ≥ ~50 judged traces from Phase 1.
