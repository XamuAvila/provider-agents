import { spawn as cpSpawn } from "node:child_process";
import { createWriteStream } from "node:fs";
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
): string[] {
  const args = [
    "-p", prompt,
    "--settings", profile.settings,
    "--model", profile.model,
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
  for (const tool of profile.allowed_tools ?? []) {
    args.push("--allowedTools", tool);
  }
  if (extraArgs) {
    args.push(...extraArgs);
  }

  return args;
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
  const args = ["-m", profile.model];

  if (profile.system_prompt) {
    args.push("--system-prompt", profile.system_prompt);
  }
  for (const arg of profile.args ?? []) {
    args.push(arg);
  }

  const useStdin = profile.stdin ?? false;
  if (!useStdin) {
    args.push(prompt);
  }

  return {
    command: profile.command,
    args,
    stdin: useStdin ? prompt : undefined,
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
): Promise<SpawnResult> {
  const timeout = (profile.timeout ?? DEFAULT_TIMEOUT) * 1000;
  const start = Date.now();

  let command: string;
  let args: string[];
  let stdinData: string | undefined;

  if (profile.invocation === "claude-p") {
    command = "claude";
    args = buildClaudePArgs(profile, prompt, extraArgs);
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
        model: profile.model,
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
        model: profile.model,
        durationMs: Date.now() - start,
      });
    });
  });
}
