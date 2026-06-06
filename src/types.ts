export interface ClaudePProfile {
  invocation: "claude-p";
  settings: string;
  model: string;
  system_prompt?: string;
  bare?: boolean;
  timeout?: number;
  mcp_config?: string[];
  allowed_tools?: string[];
  description: string;
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
