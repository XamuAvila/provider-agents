import { describe, it, expect } from "vitest";
import { deriveTags, buildTrace } from "./trace.js";
import type { CoordinationResult } from "./types.js";

describe("deriveTags", () => {
  it("tags a Python function prompt as code+python (HumanEval shape)", () => {
    const t = deriveTags('def has_close(numbers, threshold):\n    """Check ..."""');
    expect(t).toContain("python");
    expect(t).toContain("code");
  });
  it("tags a reasoning prompt", () => {
    expect(deriveTags("Explain why this request times out; give the root cause")).toContain("reasoning");
  });
  it("tags a SQL task as code+sql", () => {
    const t = deriveTags("Write a SQL query: SELECT name FROM users");
    expect(t).toContain("sql");
    expect(t).toContain("code");
  });
  it("falls back to general", () => {
    expect(deriveTags("hello there")).toEqual(["general"]);
  });
  it("tags security tasks", () => {
    expect(deriveTags("audit this for OWASP injection vulnerabilities")).toContain("security");
  });
});

describe("buildTrace", () => {
  it("builds a Trace from a CoordinationResult", () => {
    const result: CoordinationResult = { answer: "a", turns: [], accepted: true, traceId: "2026-06-23T00:00:00.000Z-x" };
    const tr = buildTrace("def f(): pass", result, "2026-06-23T00:00:00.000Z");
    expect(tr.id).toBe("2026-06-23T00:00:00.000Z-x");
    expect(tr.task).toBe("def f(): pass");
    expect(tr.taskTags).toContain("python");
    expect(tr.turns).toEqual([]);
    expect(tr.accepted).toBe(true);
    expect(tr.createdAt).toBe("2026-06-23T00:00:00.000Z");
  });
});
