// src/archon/memory.ts
import {
  readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync,
} from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import type { Policy, Trace } from "./types.js";
import { EMPTY_POLICY } from "./types.js";

const DEFAULT_VAULT = "/home/samuel/Documentos/Obsidian Vault";
// Namespaced to "archon" so traces live under <vault>/archon/ and don't collide
// with other tooling that may share the same vault.
const SUBDIR = "archon";
const TRACES = "traces";
const POLICY_FILE = "policy.md";

export function resolveVaultDir(env: NodeJS.ProcessEnv = process.env): string {
  return env.PROVIDER_AGENTS_VAULT ?? DEFAULT_VAULT;
}

function archonDir(baseDir: string): string {
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
  const dir = join(archonDir(baseDir), TRACES);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${trace.id}.md`);
  writeFileSync(path, traceToMarkdown(trace), "utf-8");
  return path;
}

export function readRecentTraces(baseDir: string, limit: number): Trace[] {
  const dir = join(archonDir(baseDir), TRACES);
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
  const path = join(archonDir(baseDir), POLICY_FILE);
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
  const dir = archonDir(baseDir);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, POLICY_FILE);
  const body = [
    `# Archon Policy (v${policy.version})`,
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
