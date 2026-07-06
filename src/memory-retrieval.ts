/**
 * Auto-recall hook: before/alongside a top-level `spawn_agent` delegation, ask
 * the cheap `memory-retriever` (deepseek-v4-flash, readonly) to surface the
 * notes in `memories/*.md` relevant to the current topic. The result flows back
 * to the MAIN conversation (a section in the spawn_agent response), NOT injected
 * into the target agent — the orchestrator decides whether to forward it.
 *
 * Symmetric counterpart to the write side (src/memory-hook.ts): the scribe
 * persists at the END of a delegation; the retriever recalls for the topic of a
 * delegation. Both live at the spawn_agent MCP-handler boundary so archon_run's
 * internal ensemble spawns neither recall nor persist.
 *
 * Design decisions (with the user, 2026-07-03):
 *  - Target = the main conversation; no auto-injection into the spawned agent.
 *  - Run CONCURRENTLY with the target agent in the handler (Promise.all), so the
 *    flash recall adds ~0 wall-clock when the target takes longer than the flash.
 *  - Default ON; env PROVIDER_AGENTS_AUTO_RECALL disables it. Skips when there is
 *    no memories/ dir yet, and never recalls for the scribe/retriever themselves.
 */
import { existsSync } from "node:fs";
import { createOutputPath, readOutput } from "./output.js";
import { spawnAgent } from "./spawner.js";
import { MEMORY_WRITER_PROFILE } from "./memory-hook.js";
import { resolveMemoriesDir } from "./memory-dir.js";
import type { Config, SpawnResult } from "./types.js";

export const MEMORY_RETRIEVER_PROFILE = "memory-retriever";
const AUTO_RECALL_ENV = "PROVIDER_AGENTS_AUTO_RECALL";
const DISABLING_VALUES = new Set(["0", "false", "off", "no"]);
// The retriever emits this exact phrase (per its system prompt) when nothing in
// memories/ is relevant. Matching it lets the handler suppress the recall block.
const NONE_MARKER = /NENHUMA mem[oó]ria relevante/i;

type SpawnFn = typeof spawnAgent;

export interface RecallDeps {
  spawn?: SpawnFn;
  env?: NodeJS.ProcessEnv;
  memoriesDir?: string;
  memoriesExist?: (dir: string) => boolean;
}

export interface RecallResult {
  found: boolean;
  text: string;
  outputPath: string;
}

/** Auto-recall is ON unless the kill-switch env var holds a disabling value. */
export function isAutoRecallEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env[AUTO_RECALL_ENV];
  if (raw === undefined) return true;
  return !DISABLING_VALUES.has(raw.trim().toLowerCase());
}

/** The instruction handed to the retriever. The topic is the delegation prompt. */
export function buildRecallPrompt(topic: string, memoriesDir: string): string {
  return [
    `Recupere memórias relevantes ao tópico abaixo lendo os arquivos em ${memoriesDir}/*.md.`,
    "",
    "## Tópico (o que está sendo discutido / a tarefa a ser delegada)",
    topic,
    "",
    "Selecione apenas as notas relevantes ao tópico. Se nada for relevante,",
    "responda exatamente: NENHUMA memória relevante.",
  ].join("\n");
}

/**
 * Retrieve relevant memories for `topic`, or null when recall is skipped
 * (loop guard, disabled, no retriever profile, no memories/ dir, or the
 * retriever run failed). Awaits the retriever internally — the caller is
 * expected to run this concurrently with the target spawn via Promise.all.
 */
export async function retrieveMemories(
  config: Config,
  sourceProfile: string,
  topic: string,
  cwd: string,
  deps: RecallDeps = {},
): Promise<RecallResult | null> {
  const spawn = deps.spawn ?? spawnAgent;
  const env = deps.env ?? process.env;
  const memoriesDir = deps.memoriesDir ?? resolveMemoriesDir(env);
  const memoriesExist = deps.memoriesExist ?? ((d) => existsSync(d));

  // Never recall for the scribe or the retriever themselves.
  if (sourceProfile === MEMORY_RETRIEVER_PROFILE || sourceProfile === MEMORY_WRITER_PROFILE) {
    return null;
  }
  if (!isAutoRecallEnabled(env)) return null;
  const profile = config.profiles[MEMORY_RETRIEVER_PROFILE];
  if (!profile) return null;
  if (!memoriesExist(memoriesDir)) return null;

  const prompt = buildRecallPrompt(topic, memoriesDir);
  const outputPath = createOutputPath(config.defaults.output_dir, MEMORY_RETRIEVER_PROFILE);

  const result: SpawnResult = await spawn(
    profile,
    MEMORY_RETRIEVER_PROFILE,
    prompt,
    outputPath,
    undefined,
    cwd,
  );
  if (result.status !== "ok") return null;

  const text = readOutput(result.outputPath).trim();
  const found = text.length > 0 && !NONE_MARKER.test(text);
  return { found, text, outputPath: result.outputPath };
}
