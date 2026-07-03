import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  realpathSync,
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
    profiles[name] = parseProfile(rawProfile, name);
  }

  return {
    defaults: {
      output_dir: raw.defaults?.output_dir ?? DEFAULT_OUTPUT_DIR,
    },
    profiles,
  };
}

function parseProfile(raw: Record<string, unknown>, name: string): Profile {
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
      skills: (raw.skills as string[]) ?? [],
    };
  }

  const permissions = (raw.permissions as string) || undefined;
  // Generated creds hold ONLY permissions, so profiles sharing a preset share one
  // settings file: derive by preset (creds/<preset>.json), not per profile name.
  // Explicit `settings` wins; fall back to the profile name only when no preset.
  const settings =
    (raw.settings as string) ??
    (permissions ? `creds/${permissions}.json` : `creds/${name}.json`);

  return {
    invocation: "claude-p",
    settings,
    model: raw.model as string,
    provider: (raw.provider as string) || undefined,
    permissions,
    system_prompt: (raw.system_prompt as string) || undefined,
    bare: (raw.bare as boolean) ?? false,
    timeout: raw.timeout as number | undefined,
    mcp_config: (raw.mcp_config as string[]) ?? [],
    description: raw.description as string,
    color: (raw.color as string) || undefined,
    tags: (raw.tags as string[]) ?? [],
    skills: (raw.skills as string[]) ?? [],
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

// Expand ~, then make absolute against baseDir if relative, then normalize.
// Shared by `settings` and every `mcp_config` entry so all profile paths
// resolve identically — claude-p receives them as raw CLI args (no shell
// expansion), so an unexpanded ~ would be resolved against cwd and break.
function resolvePath(p: string, baseDir: string): string {
  const expanded = expandHome(p);
  const absolute = isAbsolute(expanded) ? expanded : resolve(baseDir, expanded);
  return normalize(absolute);
}

export function resolveProfilePaths<T extends Profile>(
  profile: T,
  baseDir: string,
): T {
  if (profile.invocation !== "claude-p") {
    return profile;
  }

  const cp = profile as ClaudePProfile;
  const settings = resolvePath(cp.settings, baseDir);
  const mcp_config = (cp.mcp_config ?? []).map((p) => resolvePath(p, baseDir));

  return { ...profile, settings, mcp_config } as T;
}

// Directory a config file's relative settings/mcp_config paths resolve against.
// Follows symlinks so a profiles.yaml symlinked into place (the global
// ~/.config/provider-agents/profiles.yaml -> <repo>/config/profiles.yaml)
// resolves its relative paths against the REAL file's dir (the repo), not the
// symlink's location. This is what lets the shared, versioned profiles.yaml use
// repo-relative paths like `creds/deepseek.json` and still resolve correctly
// from any caller cwd. Falls back to the literal dirname when the file is
// absent or the symlink is broken.
export function configBaseDir(configPath: string): string {
  try {
    return dirname(realpathSync(configPath));
  } catch {
    return dirname(configPath);
  }
}

// The config directory the RUNTIME resolves providers.yaml + creds/secrets.json
// against — the SAME base as the global profiles.yaml. Follows the
// ~/.config/provider-agents/profiles.yaml symlink to the repo's config/ dir, so
// it works no matter where the compiled code lives (repo checkout, a global
// `npm i -g` copy under /usr/lib, or an npm link). Falls back to the literal
// ~/.config/provider-agents dir when the symlink is absent. This is why runtime
// code must NOT resolve config via `import.meta.dirname` — the code and the
// config are not co-located in a global install.
export function globalConfigDir(): string {
  return configBaseDir(
    resolve(homedir(), ".config", "provider-agents", "profiles.yaml"),
  );
}

function resolveProfiles(config: Config, baseDir: string): Config {
  const profiles: Record<string, Profile> = {};
  for (const [name, profile] of Object.entries(config.profiles)) {
    profiles[name] = resolveProfilePaths(profile, baseDir);
  }
  return { ...config, profiles };
}

export function loadMergedConfig(
  projectDir: string,
  globalPath: string = resolve(
    homedir(),
    ".config",
    "provider-agents",
    "profiles.yaml",
  ),
): Config {
  const projectPath = resolve(projectDir, ".claude", "profiles.yaml");

  // Resolve each source's relative paths against its OWN base dir BEFORE merge:
  //  - global profiles.yaml -> its real directory (the repo, via symlink), so
  //    shared `creds/x.json` paths resolve into the repo from any cwd.
  //  - project .claude/profiles.yaml -> the project root (unchanged behavior).
  const global = resolveProfiles(loadConfig(globalPath), configBaseDir(globalPath));
  const project = resolveProfiles(loadConfig(projectPath), projectDir);

  return mergeConfigs(global, project);
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
    if (profile.provider) raw.provider = profile.provider;
    if (profile.permissions) raw.permissions = profile.permissions;
    if (profile.bare) raw.bare = profile.bare;
    if (profile.mcp_config?.length) raw.mcp_config = profile.mcp_config;
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
