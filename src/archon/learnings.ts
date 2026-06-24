// src/archon/learnings.ts
//
// Eval-failure → Obsidian "learning" persistence. Every problem an eval surfaces
// (a regression, an unsolved case, or an ensemble recovery) is distilled into a
// markdown note in the Obsidian vault under `Learnings/<source>/`, plus a line in
// `Learnings/_index.md` (a Map-of-Content). The vault is the same one the Archon
// memory uses; Obsidian indexes the folder, so these notes are readable by any
// future agent/model — institutional memory that outlives a single session.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import type { Learning } from "./types.js";
import { resolveVaultDir } from "./memory.js";

const LEARNINGS = "Learnings";
const INDEX_FILE = "_index.md";

export function resolveLearningsDir(env: NodeJS.ProcessEnv = process.env): string {
  return join(resolveVaultDir(env), LEARNINGS);
}

/** "HumanEval/10" -> "10"; falls back to a kebab of the whole id. */
function problemKey(problemId: string): string {
  const tail = problemId.split("/").pop() ?? problemId;
  return tail.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function learningToMarkdown(l: Learning): string {
  const data: Record<string, unknown> = {
    name: l.id,
    description: l.description,
    tags: l.tags,
    metadata: {
      type: "learning",
      severity: l.severity,
      source: l.source,
      ...(l.problemId ? { problemId: l.problemId } : {}),
      createdAt: l.createdAt,
    },
  };
  const body = [
    `# ${l.title}`,
    `\n**What happened:** ${l.whatHappened}`,
    `\n**Root cause:** ${l.rootCause}`,
    `\n**Lesson:** ${l.lesson}`,
    `\n**How to apply:** ${l.howToApply}`,
    `\n> source: ${l.source}${l.problemId ? ` · problem: ${l.problemId}` : ""} · severity: ${l.severity} · ${l.createdAt}`,
  ].join("\n");
  return `---\n${yaml.dump(data, { lineWidth: -1 })}---\n\n${body}\n`;
}

export interface EvalFailureInput {
  source: string;
  problemId: string;
  prompt: string;
  baselinePassed: boolean;
  archonPassed: boolean;
  createdAt: string;
}

/**
 * Classify an eval outcome into a Learning. Three actionable shapes:
 * - regression (baseline solved, ensemble did not) — HIGH; the ensemble threw away a win.
 * - capability-gap (neither solved) — MEDIUM; the pool can't do this class.
 * - recovery (only the ensemble solved) — LOW; a positive proof of the thesis.
 */
export function evalFailureToLearning(i: EvalFailureInput): Learning {
  const key = problemKey(i.problemId);
  const base = { source: i.source, problemId: i.problemId, tags: [i.source, "eval"], createdAt: i.createdAt };
  if (i.baselinePassed && !i.archonPassed) {
    return {
      ...base,
      id: `${i.source}-${key}-regression`,
      title: `Archon regressed on ${i.problemId}`,
      description: `${i.problemId}: single baseline passed but the ensemble failed — selection discarded a correct answer.`,
      tags: [...base.tags, "regression", "selection"],
      severity: "high",
      whatHappened: "The single-model baseline solved this problem; the Archon ensemble did NOT.",
      rootCause:
        "Execution-grounded selection chose a candidate that fails the hidden test — its self-generated tests likely mis-ranked candidates.",
      lesson: "An ensemble can underperform a single strong model when its self-generated tests are wrong.",
      howToApply:
        "Rank candidates by passed-test COUNT (not all-or-nothing), anchor generated tests on the task's concrete examples, and break ties toward the strongest generator.",
    };
  }
  if (!i.baselinePassed && !i.archonPassed) {
    return {
      ...base,
      id: `${i.source}-${key}-capability-gap`,
      title: `Unsolved by baseline and ensemble: ${i.problemId}`,
      description: `${i.problemId}: neither baseline nor ensemble solved it — pool capability gap.`,
      tags: [...base.tags, "capability-gap"],
      severity: "medium",
      whatHappened: "Neither the single baseline nor the Archon ensemble produced a passing solution.",
      rootCause: "No generator in the current pool produced a correct candidate for this problem class.",
      lesson: "This problem class is beyond the current pool's capability — diversity/strategy is missing.",
      howToApply:
        "Add a stronger or more-diverse generator for this class, or add a self-repair loop that feeds failing tests back to the generator.",
    };
  }
  // recovery: !baselinePassed && archonPassed (or both passed — still framed as a win)
  return {
    ...base,
    id: `${i.source}-${key}-recovery`,
    title: `Ensemble recovered ${i.problemId} (baseline failed)`,
    description: `${i.problemId}: ensemble solved what the single baseline missed — execution-grounded recovery.`,
    tags: [...base.tags, "recovery"],
    severity: "low",
    whatHappened: "The single baseline FAILED this problem but the Archon ensemble SOLVED it.",
    rootCause: "A diverse generator produced a correct candidate and execution-grounded selection chose it.",
    lesson: "Ensemble + execution selection recovers failures of any single model — the core Archon thesis.",
    howToApply:
      "Keep the generator pool diverse across model families and keep execution-grounded selection on for code tasks.",
  };
}

export function writeLearning(l: Learning, vaultDir: string): string {
  const dir = join(vaultDir, LEARNINGS, l.source);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${l.id}.md`);
  writeFileSync(path, learningToMarkdown(l), "utf-8");
  return path;
}

const SEVERITY_MARK: Record<Learning["severity"], string> = {
  critical: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🟢",
};

/**
 * Append/replace a one-line entry for this learning in `Learnings/_index.md`.
 * Idempotent by `id`: re-running an eval refreshes the line instead of duplicating.
 */
export function upsertLearningIndex(l: Learning, vaultDir: string): string {
  const dir = join(vaultDir, LEARNINGS);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, INDEX_FILE);
  const header = "# Learnings — index\n\nLessons distilled from eval failures. Read before acting.\n";
  const line = `- ${SEVERITY_MARK[l.severity]} [[${l.id}]] — ${l.description}`;
  const existing = existsSync(path) ? readFileSync(path, "utf-8") : header;
  const kept = existing
    .split("\n")
    .filter((row) => !row.includes(`[[${l.id}]]`))
    .join("\n")
    .replace(/\n+$/, "");
  writeFileSync(path, `${kept}\n${line}\n`, "utf-8");
  return path;
}
