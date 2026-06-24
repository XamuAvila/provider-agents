import { readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { spawnAgent } from "../spawner.js";
import { loadMergedConfig } from "../config.js";
import type { ArchitectureSpec, Candidate, EngineDeps } from "./types.js";
import { deriveTags } from "./trace.js";
import { bestPracticeSpec, assemble, type Pools } from "./assemble.js";
import { writeTrace } from "./memory.js";

/** Default model pool — verified-working profiles (see plan MODEL POOL). The
 *  reliable `deepseek` anchors every role; free diverse generators widen the
 *  ensemble. Override per call via RunOpts.pools. */
export const DEFAULT_POOLS: Pools = {
  generators: ["deepseek", "gen-gptoss", "gen-nemotron-super", "gen-gemma"],
  fuser: "deepseek",
  critic: "deepseek",
  ranker: "deepseek",
  verifiers: ["deepseek", "gen-gptoss", "gen-nemotron-super"],
  tester: "deepseek",
};

export interface RuntimeOpts {
  /** dir whose `.claude/profiles.yaml` + the global config are merged (default cwd) */
  projectDir?: string;
  /** where agent outputs are written (default config.defaults.output_dir) */
  outputDir?: string;
  /** cwd passed to spawned agents */
  cwd?: string;
  /** optional KB/policy text prepended to every spawned prompt */
  policyPreamble?: string;
}

/**
 * Build a real EngineDeps bound to the provider-agents spawner: resolves a
 * profile name to its Profile, spawns the agent (output written to a unique
 * file), and reads that file back. `outputPathFor` returns a fresh unique path
 * per call so concurrent layer spawns never collide.
 */
export function makeEngineDeps(opts: RuntimeOpts = {}): EngineDeps {
  const projectDir = opts.projectDir ?? process.cwd();
  const config = loadMergedConfig(projectDir);
  const baseDir = opts.outputDir ?? config.defaults.output_dir;
  mkdirSync(baseDir, { recursive: true });
  const preamble = opts.policyPreamble ? `${opts.policyPreamble}\n\n` : "";
  let counter = 0;
  return {
    spawn: async (profileName, prompt, outputPath, cwd) => {
      const profile = config.profiles[profileName];
      if (!profile) {
        return { status: "error", exitCode: 1, outputPath, profile: profileName, model: "unknown", durationMs: 0 };
      }
      return spawnAgent(profile, profileName, preamble + prompt, outputPath, [], cwd ?? opts.cwd);
    },
    readOutput: (path) => {
      try {
        return readFileSync(path, "utf-8");
      } catch {
        return "";
      }
    },
    outputPathFor: (label) =>
      join(baseDir, `archon-${process.pid}-${counter++}-${label.replace(/[^a-zA-Z0-9_-]/g, "_")}.txt`),
  };
}

export interface RunOpts extends RuntimeOpts {
  /** inject an EngineDeps (tests); when absent a real one is built */
  deps?: EngineDeps;
  /** per-role profile pool (default DEFAULT_POOLS) */
  pools?: Pools;
  /** sandbox language for code tasks (default "python") */
  lang?: string;
  /** vault dir to persist a trace; when absent, no trace is written */
  vaultDir?: string;
  /** ISO timestamp source (injectable for determinism) */
  nowIso?: () => string;
}

export interface RunResult {
  answer: string;
  spec: ArchitectureSpec;
  traceId: string;
  candidates: Candidate[];
}

/**
 * End-to-end Archon run: tag the task, pick the best-practice spec, assemble the
 * pipeline over the pool, and (optionally) persist a trace to the vault. The
 * weight-free analog of TRINITY/Conductor — the policy lives as text, not weights.
 */
export async function runArchon(task: string, opts: RunOpts = {}): Promise<RunResult> {
  const tags = deriveTags(task);
  const spec = bestPracticeSpec(tags);
  const deps = opts.deps ?? makeEngineDeps(opts);
  const pools = opts.pools ?? DEFAULT_POOLS;
  const { answer, candidates } = await assemble(task, tags, spec, deps, pools, opts.lang ?? "python");
  const createdAt = opts.nowIso ? opts.nowIso() : new Date().toISOString();
  const traceId = `${createdAt}-${spec.name}`;
  if (opts.vaultDir) {
    writeTrace(
      {
        id: traceId,
        task,
        taskTags: tags,
        turns: [],
        accepted: answer.length > 0,
        score: candidates[0]?.score,
        createdAt,
      },
      opts.vaultDir,
    );
  }
  return { answer, spec, traceId, candidates };
}
