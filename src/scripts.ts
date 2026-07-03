/**
 * Agent-scripts registry: executable files (shell/node/etc., with a shebang)
 * that the MCP can register, list, read, remove, and run, and that profiles can
 * reference via `scripts: []`.
 *
 * Physical folder `agent-scripts/` at the repo root — deliberately SEPARATE from
 * the repo's build `scripts/` (gen-creds, bootstrap-secrets) so a run_script can
 * never execute build tooling. Mirrors the skills/ model (physical, referenced
 * by name).
 *
 * SECURITY: register/remove/run all validate the name against a strict charset
 * and never accept path separators or `..`, so an LLM-supplied name can only
 * ever address a file INSIDE agent-scripts/.
 */
import {
  readdirSync,
  readFileSync,
  existsSync,
  writeFileSync,
  mkdirSync,
  unlinkSync,
  chmodSync,
  statSync,
} from "node:fs";
import { spawn as cpSpawn } from "node:child_process";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const SCRIPTS_DIR = resolve(__dirname, "..", "agent-scripts");

// Letters, digits, dot, dash, underscore only — no slashes, no `..`.
const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const MAX_SCRIPT_BYTES = 256 * 1024; // 256 KB — a registered script, not a blob.

export interface ScriptInfo {
  name: string;
  path: string;
  description: string;
  sizeBytes: number;
}

export interface RunResult {
  status: "ok" | "error" | "timeout";
  exitCode: number;
  stdout: string;
  stderr: string;
}

export function getScriptsDir(): string {
  return SCRIPTS_DIR;
}

/**
 * Reject any name that is not a plain filename in agent-scripts/. This is the
 * single trust-boundary guard for every LLM-supplied script name.
 */
export function validateScriptName(name: string): void {
  if (name.includes("/") || name.includes("\\") || name.includes("..") || !NAME_RE.test(name)) {
    throw new Error(
      `Invalid script name "${name}": use only letters, digits, dot, dash, underscore (a plain filename, no path separators or '..').`,
    );
  }
}

// First `# description:` / `// description:` header line, if any.
function extractDescription(content: string): string {
  const m = content.match(/^\s*(?:#|\/\/)\s*description:\s*(.+)$/im);
  return m?.[1]?.trim() ?? "";
}

export function listScripts(dir: string = SCRIPTS_DIR): ScriptInfo[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    // Skip dotfiles and Markdown docs (README.md et al. are not scripts).
    .filter((d) => d.isFile() && !d.name.startsWith(".") && !d.name.toLowerCase().endsWith(".md"))
    .map((d) => {
      const path = join(dir, d.name);
      const content = readFileSync(path, "utf-8");
      return {
        name: d.name,
        path,
        description: extractDescription(content),
        sizeBytes: statSync(path).size,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function scriptExists(name: string, dir: string = SCRIPTS_DIR): boolean {
  validateScriptName(name);
  return existsSync(join(dir, name));
}

export function getScript(name: string, dir: string = SCRIPTS_DIR): string | null {
  validateScriptName(name);
  const path = join(dir, name);
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf-8");
}

/** Create or overwrite a script file (chmod 0o755 so it is runnable). */
export function writeScript(
  name: string,
  content: string,
  dir: string = SCRIPTS_DIR,
): ScriptInfo {
  validateScriptName(name);
  if (Buffer.byteLength(content, "utf-8") > MAX_SCRIPT_BYTES) {
    throw new Error(`Script "${name}" exceeds the ${MAX_SCRIPT_BYTES}-byte limit.`);
  }
  mkdirSync(dir, { recursive: true });
  const path = join(dir, name);
  writeFileSync(path, content, "utf-8");
  chmodSync(path, 0o755);
  return {
    name,
    path,
    description: extractDescription(content),
    sizeBytes: statSync(path).size,
  };
}

export function removeScript(name: string, dir: string = SCRIPTS_DIR): boolean {
  validateScriptName(name);
  const path = join(dir, name);
  if (!existsSync(path)) return false;
  unlinkSync(path);
  return true;
}

/** Resolve registered script names to their existing file paths (skips unknown). */
export function resolveScriptPaths(names: string[], dir: string = SCRIPTS_DIR): string[] {
  return names
    .filter((n) => NAME_RE.test(n) && !n.includes(".."))
    .map((n) => join(dir, n))
    .filter((p) => existsSync(p));
}

/**
 * Execute a registered script by name, capturing stdout/stderr. The file must
 * exist in agent-scripts/ and carry its own shebang; it is spawned directly, so
 * only registered files can ever run. Callers gate this behind the exec env
 * switch — runScript itself does NOT check the switch.
 */
export function runScript(
  name: string,
  args: string[] = [],
  opts: { dir?: string; cwd?: string; timeoutMs?: number } = {},
): Promise<RunResult> {
  const dir = opts.dir ?? SCRIPTS_DIR;
  validateScriptName(name);
  const path = join(dir, name);
  if (!existsSync(path)) {
    return Promise.resolve({
      status: "error",
      exitCode: 127,
      stdout: "",
      stderr: `Script "${name}" is not registered in agent-scripts/.`,
    });
  }

  const timeout = opts.timeoutMs ?? 120_000;
  return new Promise<RunResult>((res) => {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeout);
    let stdout = "";
    let stderr = "";

    const child = cpSpawn(path, args, {
      signal: ac.signal,
      cwd: opts.cwd ?? process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout?.on("data", (d) => (stdout += d.toString()));
    child.stderr?.on("data", (d) => (stderr += d.toString()));

    child.on("close", (code) => {
      clearTimeout(timer);
      res({ status: code === 0 ? "ok" : "error", exitCode: code ?? 1, stdout, stderr });
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      const isTimeout = err.name === "AbortError";
      res({
        status: isTimeout ? "timeout" : "error",
        exitCode: isTimeout ? 124 : 1,
        stdout,
        stderr: stderr || err.message,
      });
    });
  });
}
