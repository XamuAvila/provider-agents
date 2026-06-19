import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { resolve, normalize, isAbsolute, dirname } from "node:path";
import { homedir } from "node:os";
import yaml from "js-yaml";
import type { Config, RawConfig, Profile, ClaudePProfile } from "./types.js";

const DEFAULT_OUTPUT_DIR = "/tmp/provider-agents";

export function loadConfig(filePath: string): Config {
  if (!existsSync(filePath)) {
    return { defaults: { output_dir: DEFAULT_OUTPUT_DIR }, profiles: {} };
  }

  const raw = yaml.load(readFileSync(filePath, "utf-8")) as RawConfig | null;
  if (!raw) {
    return { defaults: { output_dir: DEFAULT_OUTPUT_DIR }, profiles: {} };
  }

  const profiles: Record<string, Profile> = {};
  for (const [name, rawProfile] of Object.entries(raw.profiles ?? {})) {
    profiles[name] = parseProfile(rawProfile);
  }

  return {
    defaults: {
      output_dir: raw.defaults?.output_dir ?? DEFAULT_OUTPUT_DIR,
    },
    profiles,
  };
}

function parseProfile(raw: Record<string, unknown>): Profile {
  const invocation = (raw.invocation as string) ?? "claude-p";

  if (invocation === "cli") {
    return {
      invocation: "cli",
      command: raw.command as string,
      model: raw.model as string,
      system_prompt: (raw.system_prompt as string) || undefined,
      stdin: (raw.stdin as boolean) ?? false,
      timeout: raw.timeout as number | undefined,
      args: (raw.args as string[]) ?? [],
      description: raw.description as string,
      color: (raw.color as string) || undefined,
      tags: (raw.tags as string[]) ?? [],
    };
  }

  return {
    invocation: "claude-p",
    settings: raw.settings as string,
    model: raw.model as string,
    system_prompt: (raw.system_prompt as string) || undefined,
    bare: (raw.bare as boolean) ?? false,
    timeout: raw.timeout as number | undefined,
    mcp_config: (raw.mcp_config as string[]) ?? [],
    allowed_tools: (raw.allowed_tools as string[]) ?? [],
    description: raw.description as string,
    color: (raw.color as string) || undefined,
    tags: (raw.tags as string[]) ?? [],
  };
}

export function mergeConfigs(global: Config, project: Config): Config {
  const projectOverridesDir =
    project.defaults.output_dir !== DEFAULT_OUTPUT_DIR;

  return {
    defaults: {
      output_dir: projectOverridesDir
        ? project.defaults.output_dir
        : global.defaults.output_dir,
    },
    profiles: { ...global.profiles, ...project.profiles },
  };
}

function expandHome(p: string): string {
  if (p.startsWith("~/") || p === "~") {
    return resolve(homedir(), p.slice(2));
  }
  return p;
}

export function resolveProfilePaths<T extends Profile>(
  profile: T,
  baseDir: string,
): T {
  if (profile.invocation !== "claude-p") {
    return profile;
  }

  const cp = profile as ClaudePProfile;
  let settings = expandHome(cp.settings);
  if (!isAbsolute(settings)) {
    settings = resolve(baseDir, settings);
  }
  settings = normalize(settings);

  return { ...profile, settings } as T;
}

export function loadMergedConfig(projectDir: string): Config {
  const globalPath = resolve(
    homedir(),
    ".config",
    "provider-agents",
    "profiles.yaml",
  );
  const projectPath = resolve(projectDir, ".claude", "profiles.yaml");

  const global = loadConfig(globalPath);
  const project = loadConfig(projectPath);
  const merged = mergeConfigs(global, project);

  const resolved: Record<string, Profile> = {};
  for (const [name, profile] of Object.entries(merged.profiles)) {
    resolved[name] = resolveProfilePaths(profile, projectDir);
  }

  return { ...merged, profiles: resolved };
}

function profileToRaw(profile: Profile): Record<string, unknown> {
  const raw: Record<string, unknown> = {
    invocation: profile.invocation,
    model: profile.model,
  };

  if (profile.system_prompt) raw.system_prompt = profile.system_prompt;
  if (profile.timeout !== undefined) raw.timeout = profile.timeout;
  if (profile.description) raw.description = profile.description;

  if (profile.invocation === "claude-p") {
    raw.settings = profile.settings;
    if (profile.bare) raw.bare = profile.bare;
    if (profile.mcp_config?.length) raw.mcp_config = profile.mcp_config;
    if (profile.allowed_tools?.length)
      raw.allowed_tools = profile.allowed_tools;
  } else {
    raw.command = profile.command;
    if (profile.stdin) raw.stdin = profile.stdin;
    if (profile.args?.length) raw.args = profile.args;
  }

  return raw;
}

export function addProjectProfile(
  projectDir: string,
  name: string,
  profile: Profile,
): void {
  const projectPath = resolve(projectDir, ".claude", "profiles.yaml");
  const existing = loadConfig(projectPath);

  // Preserve defaults, add/overwrite the named profile
  const rawDefaults = existing.defaults.output_dir
    ? { output_dir: existing.defaults.output_dir }
    : {};

  const rawProfiles: Record<string, Record<string, unknown>> = {};
  for (const [n, p] of Object.entries(existing.profiles)) {
    rawProfiles[n] = profileToRaw(p);
  }
  rawProfiles[name] = profileToRaw(profile);

  const raw: RawConfig = { defaults: rawDefaults, profiles: rawProfiles };

  mkdirSync(dirname(projectPath), { recursive: true });
  writeFileSync(projectPath, yaml.dump(raw, { lineWidth: -1 }), "utf-8");
}

export function removeProjectProfile(
  projectDir: string,
  name: string,
): boolean {
  const projectPath = resolve(projectDir, ".claude", "profiles.yaml");
  const existing = loadConfig(projectPath);

  if (!existing.profiles[name]) {
    return false;
  }

  const rawDefaults = existing.defaults.output_dir
    ? { output_dir: existing.defaults.output_dir }
    : {};

  const rawProfiles: Record<string, Record<string, unknown>> = {};
  for (const [n, p] of Object.entries(existing.profiles)) {
    if (n !== name) {
      rawProfiles[n] = profileToRaw(p);
    }
  }

  const raw: RawConfig = { defaults: rawDefaults, profiles: rawProfiles };

  writeFileSync(projectPath, yaml.dump(raw, { lineWidth: -1 }), "utf-8");
  return true;
}
