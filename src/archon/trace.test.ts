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

  // --- regression: prose must NOT be mis-tagged as code ---
  it("does not tag prose 'select ... from' as sql", () => {
    expect(deriveTags("Select the best candidate from the list of applicants")).toEqual(["general"]);
  });
  it("does not tag prose 'import the dataset' as python", () => {
    expect(deriveTags("Let's import the latest dataset")).not.toContain("python");
  });
  it("does not tag 'user interface design' as typescript", () => {
    expect(deriveTags("The user interface design needs work")).not.toContain("typescript");
  });
  it("does not tag 'the function of the liver' as code", () => {
    expect(deriveTags("The function of the liver is to filter blood")).toEqual(["general"]);
  });
  it("does not tag 'namespace of discourse' as csharp", () => {
    expect(deriveTags("in the namespace of academic discourse")).not.toContain("csharp");
  });
  // --- positive: real code in each language ---
  it("tags real SQL (select...from...where) as sql+code", () => {
    const t = deriveTags("SELECT id FROM users WHERE active = 1");
    expect(t).toContain("sql"); expect(t).toContain("code");
  });
  it("tags exported TS interface as typescript+code, not javascript", () => {
    const t = deriveTags("export interface UserProfile { name: string }");
    expect(t).toContain("typescript"); expect(t).toContain("code"); expect(t).not.toContain("javascript");
  });
  it("tags a JS function as javascript+code", () => {
    const t = deriveTags("function greet(name) { return name }");
    expect(t).toContain("javascript"); expect(t).toContain("code");
  });
  it("tags a C# namespace as csharp+code, with csharp appearing once (deduped)", () => {
    const t = deriveTags("namespace MyApp { public class Foo {} }");
    expect(t).toContain("csharp"); expect(t).toContain("code");
    expect(t.filter((x) => x === "csharp")).toHaveLength(1);
  });
  it("tags pure code-intent without a language as code", () => {
    expect(deriveTags("implement a solution to this problem")).toEqual(["code"]);
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
