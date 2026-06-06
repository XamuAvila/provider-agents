import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { loadConfig, mergeConfigs, resolveProfilePaths } from "../src/config.js";

const FIXTURES = join(import.meta.dirname, "fixtures");

describe("loadConfig", () => {
  it("loads a valid YAML file and returns typed config", () => {
    const config = loadConfig(join(FIXTURES, "global-profiles.yaml"));
    expect(config.profiles).toHaveProperty("deepseek");
    expect(config.profiles["deepseek"].invocation).toBe("claude-p");
    expect(config.profiles["deepseek"].model).toBe("deepseek-v4-pro");
    expect(config.defaults.output_dir).toBe("/tmp/provider-agents");
  });

  it("returns empty config for missing file", () => {
    const config = loadConfig("/nonexistent/path.yaml");
    expect(config.profiles).toEqual({});
    expect(config.defaults.output_dir).toBe("/tmp/provider-agents");
  });

  it("applies default output_dir when not specified", () => {
    const config = loadConfig(join(FIXTURES, "global-profiles.yaml"));
    expect(config.defaults.output_dir).toBe("/tmp/provider-agents");
  });
});

describe("mergeConfigs", () => {
  it("project profiles override global profiles with same name", () => {
    const global = loadConfig(join(FIXTURES, "global-profiles.yaml"));
    const project = loadConfig(join(FIXTURES, "project-profiles.yaml"));
    const merged = mergeConfigs(global, project);

    expect(merged.profiles["deepseek"].model).toBe("deepseek-v4-pro[1m]");
    expect(merged.profiles["deepseek"].description).toBe(
      "DeepSeek project override.",
    );
  });

  it("preserves global-only profiles", () => {
    const global = loadConfig(join(FIXTURES, "global-profiles.yaml"));
    const project = loadConfig(join(FIXTURES, "project-profiles.yaml"));
    const merged = mergeConfigs(global, project);

    expect(merged.profiles).toHaveProperty("shared-kimi");
    expect(merged.profiles["shared-kimi"].model).toBe("kimi-k2.5");
  });

  it("adds project-only profiles", () => {
    const global = loadConfig(join(FIXTURES, "global-profiles.yaml"));
    const project = loadConfig(join(FIXTURES, "project-profiles.yaml"));
    const merged = mergeConfigs(global, project);

    expect(merged.profiles).toHaveProperty("codex");
    expect(merged.profiles["codex"].invocation).toBe("cli");
  });

  it("project defaults override global defaults", () => {
    const global = loadConfig(join(FIXTURES, "global-profiles.yaml"));
    const project = loadConfig(join(FIXTURES, "project-profiles.yaml"));
    const merged = mergeConfigs(global, project);

    expect(merged.defaults.output_dir).toBe("/tmp/my-project-agents");
  });
});

describe("resolveProfilePaths", () => {
  it("expands ~ in settings path", () => {
    const profile = {
      invocation: "claude-p" as const,
      settings: "~/configs/deepseek.json",
      model: "deepseek-v4-pro",
      description: "test",
    };
    const resolved = resolveProfilePaths(profile, "/project/root");
    expect(resolved.settings).not.toContain("~");
    expect(resolved.settings).toMatch(/^\/home\//);
  });

  it("resolves relative settings path against base dir", () => {
    const profile = {
      invocation: "claude-p" as const,
      settings: ".claude/deepseek.json",
      model: "deepseek-v4-pro",
      description: "test",
    };
    const resolved = resolveProfilePaths(profile, "/project/root");
    expect(resolved.settings).toBe("/project/root/.claude/deepseek.json");
  });

  it("leaves absolute settings path unchanged", () => {
    const profile = {
      invocation: "claude-p" as const,
      settings: "/abs/path/deepseek.json",
      model: "deepseek-v4-pro",
      description: "test",
    };
    const resolved = resolveProfilePaths(profile, "/project/root");
    expect(resolved.settings).toBe("/abs/path/deepseek.json");
  });

  it("returns cli profiles unchanged", () => {
    const profile = {
      invocation: "cli" as const,
      command: "pplx",
      model: "sonar-pro",
      description: "test",
    };
    const resolved = resolveProfilePaths(profile, "/project/root");
    expect(resolved).toEqual(profile);
  });
});
