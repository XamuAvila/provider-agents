import { homedir } from "node:os";
import { join } from "node:path";

export const DEFAULT_MEMORIES_DIR = join(homedir(), ".provider-agents", "memories");
export const MEMORIES_DIR_ENV = "PROVIDER_AGENTS_MEMORIES_DIR";

export function resolveMemoriesDir(env: NodeJS.ProcessEnv = process.env): string {
  return env[MEMORIES_DIR_ENV] ?? DEFAULT_MEMORIES_DIR;
}
