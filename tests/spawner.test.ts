import { describe, it, expect } from "vitest";
import { buildClaudePArgs, buildCliArgs, resolveSpawnEnv } from "../src/spawner.js";
import type { ClaudePProfile, CliProfile } from "../src/types.js";
import type { ProviderDef } from "../src/providers.js";

const PROVIDERS: Record<string, ProviderDef> = {
  deepseek: { base_url: "https://api.deepseek.com/anthropic", model: "deepseek-v4-pro" },
  moonshot: { base_url: "https://api.moonshot.ai/anthropic", model: "kimi-k2.6" },
};
const SPAWN_SECRETS = {
  deepseek: { ANTHROPIC_AUTH_TOKEN: "sk-DS" },
  moonshot: { ANTHROPIC_AUTH_TOKEN: "sk-MOON" },
};
const spawnProfile: ClaudePProfile = {
  invocation: "claude-p",
  settings: "creds/explorer.json",
  model: "deepseek-v4-pro",
  provider: "deepseek",
  description: "t",
};

describe("resolveSpawnEnv", () => {
  it("uses the profile's provider and model by default", () => {
    const { env, model } = resolveSpawnEnv(spawnProfile, undefined, undefined, PROVIDERS, SPAWN_SECRETS);
    expect(env.ANTHROPIC_BASE_URL).toBe("https://api.deepseek.com/anthropic");
    expect(env.ANTHROPIC_AUTH_TOKEN).toBe("sk-DS");
    expect(model).toBe("deepseek-v4-pro");
  });

  it("override switches provider env AND model to the provider default", () => {
    const { env, model } = resolveSpawnEnv(spawnProfile, "moonshot", undefined, PROVIDERS, SPAWN_SECRETS);
    expect(env.ANTHROPIC_BASE_URL).toBe("https://api.moonshot.ai/anthropic");
    expect(env.ANTHROPIC_AUTH_TOKEN).toBe("sk-MOON");
    expect(model).toBe("kimi-k2.6");
  });

  it("falls back to deepseek when profile has no provider", () => {
    const { env } = resolveSpawnEnv(
      { ...spawnProfile, provider: undefined },
      undefined, undefined,
      PROVIDERS,
      SPAWN_SECRETS,
    );
    expect(env.ANTHROPIC_BASE_URL).toBe("https://api.deepseek.com/anthropic");
  });

  it("uses a validated explicit model override", () => {
    const providers = {
      ...PROVIDERS,
      moonshot: { ...PROVIDERS.moonshot, models: { "kimi-k2.7-code": { capabilities: [], context_window: 1, cost_tier: "high" as const, thinking: "always" as const } } },
    };
    const { model } = resolveSpawnEnv(spawnProfile, "moonshot", "kimi-k2.7-code", providers, SPAWN_SECRETS);
    expect(model).toBe("kimi-k2.7-code");
  });

  it("rejects a model that does not belong to the selected provider", () => {
    expect(() => resolveSpawnEnv(spawnProfile, "moonshot", "made-up", PROVIDERS, SPAWN_SECRETS)).toThrow(/unknown model/i);
  });
});

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

  it("uses the model override (4th arg) over profile.model", () => {
    const profile: ClaudePProfile = {
      invocation: "claude-p",
      settings: "/path/to/settings.json",
      model: "deepseek-v4-pro",
      description: "test",
    };
    const args = buildClaudePArgs(profile, "Hello", undefined, "kimi-k2.6");
    const i = args.indexOf("--model");
    expect(args[i + 1]).toBe("kimi-k2.6");
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

  it("includes --add-dir entries for resolved skills", () => {
    const profile: ClaudePProfile = {
      invocation: "claude-p",
      settings: "/path/to/settings.json",
      model: "deepseek-v4-pro",
      description: "test",
      skills: ["design-patterns-typescript", "nonexistent-skill"],
    };
    const args = buildClaudePArgs(profile, "Hello");
    expect(args).toContain("--add-dir");
    expect(args.filter(a => a === "--add-dir")).toHaveLength(1);
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
      command: "pplx",
      model: "sonar-pro",
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
      command: "pplx",
      model: "sonar-pro",
      args: ["--format", "text"],
      description: "test",
    };
    const result = buildCliArgs(profile, "Hello");
    expect(result.args).toContain("--format");
    expect(result.args).toContain("text");
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

  it("appends skills reference note to prompt for cli when skills resolve", () => {
    const profile: CliProfile = {
      invocation: "cli",
      command: "pplx",
      model: "sonar-pro",
      description: "test",
      skills: ["design-patterns-typescript"],
    };
    const result = buildCliArgs(profile, "Hello");
    const lastArg = result.args[result.args.length - 1];
    expect(lastArg).toContain("Hello");
    expect(lastArg).toContain("[Reference materials available at:");
  });

  it("appends skills reference note to stdin for cli when skills resolve", () => {
    const profile: CliProfile = {
      invocation: "cli",
      command: "pplx",
      model: "sonar-pro",
      stdin: true,
      description: "test",
      skills: ["design-patterns-typescript"],
    };
    const result = buildCliArgs(profile, "Hello");
    expect(result.stdin).toContain("[Reference materials available at:");
  });
});
