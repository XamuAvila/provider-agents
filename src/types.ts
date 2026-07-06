export interface ClaudePProfile {
  invocation: "claude-p";
  settings: string;          // explicit or derived (creds/<name>.json)
  model: string;
  provider?: string;         // default provider (registry key); default "deepseek" at spawn
  permissions?: string;      // permission-preset name (no-write | readonly | write-md | full)
  system_prompt?: string;
  bare?: boolean;
  timeout?: number;
  mcp_config?: string[];     // stays in YAML — cannot live in settings.json
  description: string;
  color?: string;
  tags?: string[];
  skills?: string[];
  scripts?: string[];        // registered agent-scripts associated to this profile
}

export interface CliProfile {
  invocation: "cli";
  command: string;
  model: string;
  system_prompt?: string;
  stdin?: boolean;
  timeout?: number;
  args?: string[];
  description: string;
  color?: string;
  tags?: string[];
  skills?: string[];
  scripts?: string[];        // registered agent-scripts associated to this profile
}

export type Profile = ClaudePProfile | CliProfile;

export interface ConfigDefaults {
  output_dir: string;
}

export interface Config {
  defaults: ConfigDefaults;
  profiles: Record<string, Profile>;
}

export interface RawConfig {
  defaults?: Partial<ConfigDefaults>;
  profiles?: Record<string, Record<string, unknown>>;
}

export interface SpawnOptions {
  profile: string;
  prompt: string;
  extraArgs?: string[];
  cwd?: string;
  provider?: string;
  model?: string;
}

export type SpawnStatus = "ok" | "error" | "timeout";

export interface SpawnResult {
  status: SpawnStatus;
  exitCode: number;
  outputPath: string;
  profile: string;
  model: string;
  durationMs: number;
}

export interface OutputMeta {
  path: string;
  profile: string;
  timestamp: string;
  sizeBytes: number;
}
