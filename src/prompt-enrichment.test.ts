import { describe, it, expect } from "vitest";
import { enrichPrompt, autoAddDir } from "./prompt-enrichment.js";

describe("autoAddDir", () => {
  it("injects --add-dir <cwd> when extra_args has no --add-dir and profile is claude-p", () => {
    const result = autoAddDir("claude-p", undefined, "/home/user/project");
    expect(result).toEqual(["--add-dir", "/home/user/project"]);
  });

  it("preserves existing extra_args and appends --add-dir", () => {
    const result = autoAddDir("claude-p", ["--verbose"], "/home/user/project");
    expect(result).toEqual(["--verbose", "--add-dir", "/home/user/project"]);
  });

  it("does NOT inject when extra_args already contains --add-dir", () => {
    const result = autoAddDir("claude-p", ["--add-dir", "/other"], "/home/user/project");
    expect(result).toEqual(["--add-dir", "/other"]);
  });

  it("returns undefined for cli invocation (extra_args are ignored for cli)", () => {
    const result = autoAddDir("cli", undefined, "/home/user/project");
    expect(result).toBeUndefined();
  });
});

describe("enrichPrompt", () => {
  it("wraps prompt in <context>/<task> XML tags for deepseek model", () => {
    const result = enrichPrompt("find bugs in this code", "deepseek-v4-pro");
    expect(result).toContain("<task>");
    expect(result).toContain("find bugs in this code");
    expect(result).toContain("</task>");
  });

  it("adds structured-output instruction for deepseek", () => {
    const result = enrichPrompt("analyze this", "deepseek-v4-pro");
    expect(result).toContain("structured");
  });

  it("strips 'pense passo a passo' anti-pattern from prompt for deepseek", () => {
    const result = enrichPrompt("pense passo a passo e analise", "deepseek-v4-pro");
    expect(result).not.toContain("pense passo a passo");
  });

  it("strips 'think step by step' anti-pattern from prompt for deepseek", () => {
    const result = enrichPrompt("think step by step and analyze", "deepseek-v4-pro");
    expect(result).not.toContain("think step by step");
  });

  it("does NOT modify prompt for non-deepseek models", () => {
    const original = "find bugs in this code";
    const result = enrichPrompt(original, "openai/gpt-oss-120b:free");
    expect(result).toBe(original);
  });

  it("does NOT modify prompt that already has XML tags", () => {
    const original = "<task>find bugs</task>";
    const result = enrichPrompt(original, "deepseek-v4-pro");
    expect(result).not.toContain("<task><task>");
    expect(result).toContain("<task>find bugs</task>");
  });
});
