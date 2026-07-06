/**
 * Auto-memory hook: after a top-level `spawn_agent` delegation succeeds, fire
 * the `memory-writer` profile (a cheap deepseek-v4-flash scribe) to persist a
 * durable note about what the agent did, into `memories/<slug>.md`.
 *
 * Design constraints (decided with the user, 2026-07-03):
 *  - Trigger on EVERY successful top-level spawn EXCEPT the memory-writer itself
 *    (the loop guard — a scribe persisting its own persistence would recurse).
 *  - The hook spawns the CHEAP memory-writer (flash) with the task + the already
 *    produced output. It must NOT re-run the original (expensive) agent — the
 *    whole point is to persist for near-zero extra token cost.
 *  - Fire-and-forget: never awaited. The delegating call returns immediately and
 *    must never fail because memory persistence failed.
 *  - Default ON; a kill-switch env var disables it globally.
 *
 * This lives at the `spawn_agent` MCP-handler boundary, NOT inside spawnAgent(),
 * so the internal ensemble spawns of `archon_run` do NOT each trigger a scribe.
 */
import { existsSync, mkdirSync } from "node:fs";
import { createOutputPath } from "./output.js";
import { resolveMemoriesDir } from "./memory-dir.js";
import { spawnAgent } from "./spawner.js";
import type { Config, SpawnResult } from "./types.js";

export const MEMORY_WRITER_PROFILE = "memory-writer";
const AUTO_MEMORY_ENV = "PROVIDER_AGENTS_AUTO_MEMORY";
// Default ON: only these explicit values turn the hook off.
const DISABLING_VALUES = new Set(["0", "false", "off", "no"]);

type SpawnFn = typeof spawnAgent;

export interface MemoryHookDeps {
  spawn?: SpawnFn;
  env?: NodeJS.ProcessEnv;
  memoriesDir?: string;
}

/**
 * Auto-memory is ON unless the kill-switch env var holds a disabling value.
 * Unset => enabled (the user chose "default ligado + env pra desligar").
 */
export function isAutoMemoryEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env[AUTO_MEMORY_ENV];
  if (raw === undefined) return true;
  return !DISABLING_VALUES.has(raw.trim().toLowerCase());
}

/**
 * The instruction handed to the memory-writer. It points at the source agent's
 * output file (read via --add-dir on the output dir) rather than inlining it, so
 * the flash scribe pays to read only what it needs. The scribe's own system
 * prompt governs the destination (`memories/<slug>.md`) and format.
 */
export function buildMemoryPrompt(
  sourceProfile: string,
  task: string,
  result: SpawnResult,
  memoriesDir: string,
): string {
  return [
    `A provider-agent (profile "${sourceProfile}", model ${result.model}) just`,
    `completed a delegated task. Persist anything durable worth remembering.`,
    ``,
    `## Task the agent was given`,
    task,
    ``,
    `## Where the agent's output is`,
    `Full output file: ${result.outputPath}`,
    `Read that file to see what the agent actually produced.`,
    ``,
    `## Where to write the memory note`,
    `Write to ${memoriesDir}/<slug>.md (create the folder with mkdir -p if needed).`,
    `If no durable note is warranted, write nothing and say so in one line.`,
    ``,
    `## Documentation fetched by the agent`,
    `If the agent fetched external documentation (docs, APIs, release notes,`,
    `library pages), persist a durable summary in memory as well. Include the URL,`,
    `fetch date (2026), and the key facts/versions/constraints found, so future`,
    `agents do not need to fetch the same page again.`,
    ``,
    `## Your job`,
    `Judge whether this interaction produced something durable — a decision made,`,
    `an architectural choice, a non-obvious fact discovered, a constraint, a`,
    `rejected alternative with its reason, or fetched documentation worth reusing.`,
    `If yes, write a concise note per your system prompt. If it was routine (a`,
    `trivial lookup, a throwaway answer) with nothing worth carrying to a future`,
    `session, write nothing and say so in one line.`,
  ].join("\n");
}

/**
 * Fire the memory-writer for a completed spawn, if all gates pass. Returns
 * whether the hook was triggered (queued) so the caller can surface it. The
 * memory spawn is fire-and-forget: its promise is never awaited and any
 * rejection is absorbed to stderr.
 */
export function persistMemoryHook(
  config: Config,
  sourceProfile: string,
  task: string,
  result: SpawnResult,
  cwd: string,
  deps: MemoryHookDeps = {},
): boolean {
  const spawn = deps.spawn ?? spawnAgent;
  const env = deps.env ?? process.env;

  // Loop guard: the scribe must never trigger itself.
  if (sourceProfile === MEMORY_WRITER_PROFILE) return false;
  // Global kill-switch (default ON).
  if (!isAutoMemoryEnabled(env)) return false;
  // Only a successful run has something worth persisting.
  if (result.status !== "ok") return false;
  // No scribe configured => nothing to do.
  const memProfile = config.profiles[MEMORY_WRITER_PROFILE];
  if (!memProfile) return false;

  const memoriesDir = deps.memoriesDir ?? resolveMemoriesDir(env);
  if (!existsSync(memoriesDir)) {
    mkdirSync(memoriesDir, { recursive: true });
  }

  const prompt = buildMemoryPrompt(sourceProfile, task, result, memoriesDir);
  const outputPath = createOutputPath(config.defaults.output_dir, MEMORY_WRITER_PROFILE);

  // Fire-and-forget. The `void` + `.catch` guarantees a rejected memory spawn
  // never surfaces as an unhandled rejection nor blocks the delegating call.
  void spawn(
    memProfile,
    MEMORY_WRITER_PROFILE,
    prompt,
    outputPath,
    ["--add-dir", config.defaults.output_dir],
    cwd,
  ).catch((e: unknown) => {
    console.error("[provider-agents] auto-memory hook failed:", e);
  });

  return true;
}
