import { describe, it, expect } from "vitest";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Learning } from "./types.js";
import {
  resolveLearningsDir,
  learningToMarkdown,
  evalFailureToLearning,
  writeLearning,
  upsertLearningIndex,
} from "./learnings.js";

const sample: Learning = {
  id: "humaneval-10-archon-regression",
  title: "Archon regressed on HumanEval/10",
  description: "Execution selection discarded a correct candidate because self-generated tests were wrong.",
  tags: ["archon", "selection", "regression"],
  severity: "high",
  source: "humaneval",
  problemId: "HumanEval/10",
  whatHappened: "baseline passed, archon failed",
  rootCause: "binary all-or-nothing scoring trusted a wrong self-generated test",
  lesson: "self-generated tests are not ground truth",
  howToApply: "score by passed-test count and anchor assertions on the task's given examples",
  createdAt: "2026-06-23T00:00:00.000Z",
};

describe("resolveLearningsDir", () => {
  it("uses PROVIDER_AGENTS_VAULT + Learnings when set", () => {
    const dir = resolveLearningsDir({ PROVIDER_AGENTS_VAULT: "/vault" } as NodeJS.ProcessEnv);
    expect(dir).toBe(join("/vault", "Learnings"));
  });
});

describe("learningToMarkdown", () => {
  it("emits frontmatter (name/description/metadata) and the Why/How-to-apply body", () => {
    const md = learningToMarkdown(sample);
    expect(md).toMatch(/^---\n/);
    expect(md).toContain("name: humaneval-10-archon-regression");
    expect(md).toContain("type: learning");
    expect(md).toContain("severity: high");
    expect(md).toContain("problemId: HumanEval/10");
    expect(md).toContain("**Root cause:**");
    expect(md).toContain("**How to apply:**");
    expect(md).toContain(sample.howToApply);
  });
});

describe("evalFailureToLearning", () => {
  it("classifies an archon regression (baseline pass, archon fail) as high severity", () => {
    const l = evalFailureToLearning({
      source: "humaneval",
      problemId: "HumanEval/10",
      prompt: "def make_palindrome(...)",
      baselinePassed: true,
      archonPassed: false,
      createdAt: "2026-06-23T00:00:00.000Z",
    });
    expect(l.severity).toBe("high");
    expect(l.id).toBe("humaneval-10-regression");
    expect(l.tags).toContain("regression");
  });

  it("classifies a both-failed case as a medium capability gap", () => {
    const l = evalFailureToLearning({
      source: "humaneval",
      problemId: "HumanEval/99",
      prompt: "x",
      baselinePassed: false,
      archonPassed: false,
      createdAt: "2026-06-23T00:00:00.000Z",
    });
    expect(l.severity).toBe("medium");
    expect(l.id).toBe("humaneval-99-capability-gap");
    expect(l.tags).toContain("capability-gap");
  });

  it("classifies an ensemble recovery (baseline fail, archon pass) as a low-severity win", () => {
    const l = evalFailureToLearning({
      source: "humaneval",
      problemId: "HumanEval/50",
      prompt: "x",
      baselinePassed: false,
      archonPassed: true,
      createdAt: "2026-06-23T00:00:00.000Z",
    });
    expect(l.severity).toBe("low");
    expect(l.id).toBe("humaneval-50-recovery");
    expect(l.tags).toContain("recovery");
  });
});

describe("writeLearning + upsertLearningIndex", () => {
  it("writes the note under Learnings/<source>/ and returns the path", () => {
    const vault = mkdtempSync(join(tmpdir(), "vault-"));
    const path = writeLearning(sample, vault);
    expect(path).toBe(join(vault, "Learnings", "humaneval", "humaneval-10-archon-regression.md"));
    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path, "utf-8")).toContain("name: humaneval-10-archon-regression");
  });

  it("upserts an index line idempotently (same id twice => one entry)", () => {
    const vault = mkdtempSync(join(tmpdir(), "vault-"));
    const idxPath = upsertLearningIndex(sample, vault);
    upsertLearningIndex(sample, vault);
    const idx = readFileSync(idxPath, "utf-8");
    const occurrences = idx.split("\n").filter((l) => l.includes(sample.id)).length;
    expect(occurrences).toBe(1);
    expect(idx).toContain(sample.description);
  });
});
