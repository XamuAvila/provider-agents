import { describe, it, expect } from "vitest";
import { buildClaudePArgs, buildCliArgs } from "../src/spawner.js";
import type { ClaudePProfile, CliProfile } from "../src/types.js";

describe("buildClaudePArgs", () => {
  it("builds minimal args with settings and model", () => {
    const profile: ClaudePProfile = {
      invocation: "claude-p",
      settings: "/path/to/settings.json",
      model: "deepseek-v4-pro",
      description: "test",
    };
    const args = buildClaudePArgs(profile, "Hello");
    expect(args).toEqual([
      "-p", "Hello",
      "--settings", "/path/to/settings.json",
      "--model", "deepseek-v4-pro",
    ]);
  });

  it("includes --bare when bare is true", () => {
    const profile: ClaudePProfile = {
      invocation: "claude-p",
      settings: "/path/to/settings.json",
      model: "deepseek-v4-pro",
      bare: true,
      description: "test",
    };
    const args = buildClaudePArgs(profile, "Hello");
    expect(args).toContain("--bare");
  });

  it("includes --system-prompt when set", () => {
    const profile: ClaudePProfile = {
      invocation: "claude-p",
      settings: "/path/to/settings.json",
      model: "deepseek-v4-pro",
      system_prompt: "You are a reviewer.",
      description: "test",
    };
    const args = buildClaudePArgs(profile, "Hello");
    expect(args).toContain("--system-prompt");
    expect(args).toContain("You are a reviewer.");
  });

  it("includes --mcp-config entries", () => {
    const profile: ClaudePProfile = {
      invocation: "claude-p",
      settings: "/path/to/settings.json",
      model: "deepseek-v4-pro",
      mcp_config: ["/path/a.json", "/path/b.json"],
      description: "test",
    };
    const args = buildClaudePArgs(profile, "Hello");
    expect(args).toContain("--mcp-config");
    expect(args.filter((a) => a === "--mcp-config")).toHaveLength(2);
  });

  it("includes --allowedTools entries", () => {
    const profile: ClaudePProfile = {
      invocation: "claude-p",
      settings: "/path/to/settings.json",
      model: "deepseek-v4-pro",
      allowed_tools: ["Read", "Grep"],
      description: "test",
    };
    const args = buildClaudePArgs(profile, "Hello");
    expect(args).toContain("--allowedTools");
    expect(args).toContain("Read");
    expect(args).toContain("Grep");
  });

  it("appends extra args at the end", () => {
    const profile: ClaudePProfile = {
      invocation: "claude-p",
      settings: "/path/to/settings.json",
      model: "deepseek-v4-pro",
      description: "test",
    };
    const args = buildClaudePArgs(profile, "Hello", ["--add-dir", "./src"]);
    expect(args.slice(-2)).toEqual(["--add-dir", "./src"]);
  });
});

describe("buildCliArgs", () => {
  it("builds minimal args with model and prompt", () => {
    const profile: CliProfile = {
      invocation: "cli",
      command: "pplx",
      model: "sonar-pro",
      description: "test",
    };
    const result = buildCliArgs(profile, "Hello");
    expect(result.command).toBe("pplx");
    expect(result.args).toContain("-m");
    expect(result.args).toContain("sonar-pro");
    expect(result.args).toContain("Hello");
    expect(result.stdin).toBeUndefined();
  });

  it("uses stdin when stdin: true", () => {
    const profile: CliProfile = {
      invocation: "cli",
      command: "codex exec",
      model: "gpt-5.5",
      stdin: true,
      description: "test",
    };
    const result = buildCliArgs(profile, "Hello");
    expect(result.stdin).toBe("Hello");
    expect(result.args).not.toContain("Hello");
  });

  it("includes extra args from profile", () => {
    const profile: CliProfile = {
      invocation: "cli",
      command: "codex exec",
      model: "gpt-5.5",
      args: ["--sandbox", "workspace-write"],
      description: "test",
    };
    const result = buildCliArgs(profile, "Hello");
    expect(result.args).toContain("--sandbox");
    expect(result.args).toContain("workspace-write");
  });

  it("includes system prompt when set", () => {
    const profile: CliProfile = {
      invocation: "cli",
      command: "pplx",
      model: "sonar-pro",
      system_prompt: "Be concise.",
      description: "test",
    };
    const result = buildCliArgs(profile, "Hello");
    expect(result.args).toContain("--system-prompt");
    expect(result.args).toContain("Be concise.");
  });
});
