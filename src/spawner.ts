import { spawn as cpSpawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { join } from "node:path";
import { resolveSkillPaths } from "./skills.js";
import { globalConfigDir } from "./config.js";
import {
  resolveProviderEnv,
  loadProviders,
  loadSecrets,
  type ProviderDef,
} from "./providers.js";
import type {
  ClaudePProfile,
  CliProfile,
  Profile,
  SpawnResult,
} from "./types.js";

export function buildClaudePArgs(
  profile: ClaudePProfile,
  prompt: string,
  extraArgs?: string[],
  model?: string,
): string[] {
  const args = [
    "-p", prompt,
    "--settings", profile.settings,
    "--model", model ?? profile.model,
  ];

  if (profile.system_prompt) {
    args.push("--system-prompt", profile.system_prompt);
  }
  if (profile.bare) {
    args.push("--bare");
  }
  for (const mcp of profile.mcp_config ?? []) {
    args.push("--mcp-config", mcp);
  }
  for (const skillPath of resolveSkillPaths(profile.skills ?? [])) {
    args.push("--add-dir", skillPath);
  }
  if (extraArgs) {
    args.push(...extraArgs);
  }

  return args;
}

const DEFAULT_PROVIDER = "deepseek";

/**
 * Resolve which provider env + model a claude-p spawn should use.
 * provider = override ?? profile.provider ?? "deepseek". When the caller
 * overrides the provider, profile.model is provider-specific and no longer
 * valid, so the target provider's default model is used instead.
 */
export function resolveSpawnEnv(
  profile: ClaudePProfile,
  providerOverride: string | undefined,
  providers: Record<string, ProviderDef>,
  secrets: Record<string, Record<string, string>>,
): { env: Record<string, string>; model: string } {
  const providerName = providerOverride ?? profile.provider ?? DEFAULT_PROVIDER;
  const env = resolveProviderEnv(providerName, providers, secrets);
  const model = providerOverride ? providers[providerName].model : profile.model;
  return { env, model };
}

export interface CliSpawnArgs {
  command: string;
  args: string[];
  stdin?: string;
}

export function buildCliArgs(
  profile: CliProfile,
  prompt: string,
): CliSpawnArgs {
  let prompt_ = prompt;
  const args = ["-m", profile.model];

  if (profile.system_prompt) {
    args.push("--system-prompt", profile.system_prompt);
  }
  for (const arg of profile.args ?? []) {
    args.push(arg);
  }

  const skillPaths = resolveSkillPaths(profile.skills ?? []);
  if (skillPaths.length > 0) {
    prompt_ += `\n\n[Reference materials available at: ${skillPaths.join(", ")}. Read relevant files when needed.]`;
  }

  const useStdin = profile.stdin ?? false;
  if (!useStdin) {
    args.push(prompt_);
  }

  return {
    command: profile.command,
    args,
    stdin: useStdin ? prompt_ : undefined,
  };
}

const DEFAULT_TIMEOUT = 300;

export async function spawnAgent(
  profile: Profile,
  profileName: string,
  prompt: string,
  outputPath: string,
  extraArgs?: string[],
  cwd?: string,
  providerOverride?: string,
): Promise<SpawnResult> {
  const timeout = (profile.timeout ?? DEFAULT_TIMEOUT) * 1000;
  const start = Date.now();

  let command: string;
  let args: string[];
  let stdinData: string | undefined;
  let childEnv: NodeJS.ProcessEnv = process.env;
  let resolvedModel = profile.model;

  if (profile.invocation === "claude-p") {
    // Inject the provider env (token + base_url + tuning) into the child's
    // process env. Process env wins over the settings.json env block per the
    // Claude Code docs, and the generated settings hold only `permissions`.
    const dir = globalConfigDir();
    const providers = loadProviders(join(dir, "providers.yaml"));
    const secrets = loadSecrets(join(dir, "creds", "secrets.json"));
    const resolved = resolveSpawnEnv(profile, providerOverride, providers, secrets);
    resolvedModel = resolved.model;
    childEnv = { ...process.env, ...resolved.env };
    command = "claude";
    args = buildClaudePArgs(profile, prompt, extraArgs, resolvedModel);
  } else {
    const cliArgs = buildCliArgs(profile, prompt);
    command = cliArgs.command;
    args = cliArgs.args;
    stdinData = cliArgs.stdin;
  }

  // Split compound commands (e.g. "codex exec" -> spawn "codex" with ["exec", ...])
  const commandParts = command.split(/\s+/);
  if (commandParts.length > 1) {
    command = commandParts[0];
    args = [...commandParts.slice(1), ...args];
  }

  return new Promise<SpawnResult>((resolve) => {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeout);

    const outStream = createWriteStream(outputPath);
    const child = cpSpawn(command, args, {
      signal: ac.signal,
      cwd: cwd ?? process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
      env: childEnv,
    });

    child.stdout?.pipe(outStream);
    child.stderr?.pipe(outStream);

    if (stdinData) {
      child.stdin?.write(stdinData);
      child.stdin?.end();
    } else {
      child.stdin?.end();
    }

    child.on("close", (code) => {
      clearTimeout(timer);
      outStream.close();
      resolve({
        status: code === 0 ? "ok" : "error",
        exitCode: code ?? 1,
        outputPath,
        profile: profileName,
        model: resolvedModel,
        durationMs: Date.now() - start,
      });
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      outStream.close();
      const isTimeout = err.name === "AbortError";
      resolve({
        status: isTimeout ? "timeout" : "error",
        exitCode: isTimeout ? 124 : 1,
        outputPath,
        profile: profileName,
        model: resolvedModel,
        durationMs: Date.now() - start,
      });
    });
  });
}
