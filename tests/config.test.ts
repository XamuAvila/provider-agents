import { describe, it, expect } from "vitest";
import { join } from "node:path";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  symlinkSync,
  realpathSync,
} from "node:fs";
import { tmpdir } from "node:os";
import {
  loadConfig,
  mergeConfigs,
  resolveProfilePaths,
  loadMergedConfig,
  configBaseDir,
} from "../src/config.js";

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

  it("parses color and tags from profile", () => {
    const config = loadConfig(join(FIXTURES, "global-profiles.yaml"));
    const profile = config.profiles["deepseek"];
    expect(profile.color).toBe("#2563EB");
    expect(profile.tags).toEqual(["coding", "editing", "general"]);
  });

  it("parses skills from profile", () => {
    const config = loadConfig(join(FIXTURES, "global-profiles.yaml"));
    const profile = config.profiles["deepseek"];
    expect(profile.skills).toEqual(["design-patterns-typescript", "clean-code-csharp"]);
  });
});

describe("parseProfile — provider/permissions/derived settings", () => {
  it("derives settings path from the permissions preset when omitted", () => {
    const config = loadConfig(join(FIXTURES, "global-profiles.yaml"));
    // 'deepseek' fixture has no explicit settings + permissions: no-write
    // -> derives creds/no-write.json (keyed by preset, shared across profiles).
    const p = config.profiles["deepseek"];
    const settings = p.invocation === "claude-p" ? p.settings : "";
    expect(settings.endsWith("creds/no-write.json")).toBe(true);
  });

  it("reads provider and permissions preset", () => {
    const config = loadConfig(join(FIXTURES, "global-profiles.yaml"));
    const p = config.profiles["deepseek"];
    if (p.invocation !== "claude-p") throw new Error("expected claude-p");
    expect(p.provider).toBe("deepseek");
    expect(p.permissions).toBe("no-write");
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

  it("expands ~ in mcp_config paths", () => {
    const profile = {
      invocation: "claude-p" as const,
      settings: "/abs/settings.json",
      model: "deepseek-v4-pro",
      description: "test",
      mcp_config: ["~/.config/provider-agents/semble.mcp.json"],
    };
    const resolved = resolveProfilePaths(profile, "/project/root");
    expect(resolved.mcp_config?.[0]).not.toContain("~");
    expect(resolved.mcp_config?.[0]).toMatch(/^\/home\/.*semble\.mcp\.json$/);
  });

  it("resolves relative mcp_config paths against base dir", () => {
    const profile = {
      invocation: "claude-p" as const,
      settings: "/abs/settings.json",
      model: "deepseek-v4-pro",
      description: "test",
      mcp_config: [".claude/semble.mcp.json"],
    };
    const resolved = resolveProfilePaths(profile, "/project/root");
    expect(resolved.mcp_config?.[0]).toBe(
      "/project/root/.claude/semble.mcp.json",
    );
  });

  it("leaves absolute mcp_config paths unchanged", () => {
    const profile = {
      invocation: "claude-p" as const,
      settings: "/abs/settings.json",
      model: "deepseek-v4-pro",
      description: "test",
      mcp_config: ["/abs/semble.mcp.json"],
    };
    const resolved = resolveProfilePaths(profile, "/project/root");
    expect(resolved.mcp_config?.[0]).toBe("/abs/semble.mcp.json");
  });
});

describe("configBaseDir", () => {
  it("follows symlinks to the real file's directory", () => {
    const realDir = realpathSync(mkdtempSync(join(tmpdir(), "pa-real-")));
    const linkDir = realpathSync(mkdtempSync(join(tmpdir(), "pa-link-")));
    const realFile = join(realDir, "profiles.yaml");
    writeFileSync(realFile, "profiles: {}\n");
    const linkFile = join(linkDir, "profiles.yaml");
    symlinkSync(realFile, linkFile);

    // A profiles.yaml symlinked into place must resolve its relative paths
    // against the REAL file's dir (the repo), not the symlink's location.
    expect(configBaseDir(linkFile)).toBe(realDir);
  });

  it("falls back to the path's own dir when the file does not exist", () => {
    expect(configBaseDir("/nonexistent/dir/profiles.yaml")).toBe(
      "/nonexistent/dir",
    );
  });
});

describe("loadMergedConfig", () => {
  it("resolves global relative paths against the config file's real dir, not cwd", () => {
    // Simulate the real setup: repo/config/profiles.yaml with repo-relative
    // `creds/ds.json`, symlinked from a separate "home config" dir.
    const repoCfg = realpathSync(mkdtempSync(join(tmpdir(), "pa-repocfg-")));
    mkdirSync(join(repoCfg, "creds"));
    writeFileSync(join(repoCfg, "creds", "ds.json"), "{}");
    writeFileSync(
      join(repoCfg, "profiles.yaml"),
      [
        "profiles:",
        "  ds:",
        "    invocation: claude-p",
        "    settings: creds/ds.json",
        "    model: deepseek-v4-pro",
        "    description: t",
        "",
      ].join("\n"),
    );
    const homeCfg = realpathSync(mkdtempSync(join(tmpdir(), "pa-homecfg-")));
    const globalLink = join(homeCfg, "profiles.yaml");
    symlinkSync(join(repoCfg, "profiles.yaml"), globalLink);

    // projectDir is deliberately unrelated to the config dir: proves the
    // global relative path ignores cwd/projectDir.
    const projectDir = realpathSync(mkdtempSync(join(tmpdir(), "pa-proj-")));
    const config = loadMergedConfig(projectDir, globalLink);

    const ds = config.profiles["ds"];
    const settings = ds.invocation === "claude-p" ? ds.settings : "";
    expect(settings).toBe(join(repoCfg, "creds", "ds.json"));
  });
});
