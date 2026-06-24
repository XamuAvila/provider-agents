import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";

/** Hard cap on captured output to bound host memory against a chatty/malicious
 *  child (~200 lines, enough for a pytest stack trace). */
const MAX_OUTPUT_CHARS = 64 * 1024;

let netPrefixCache: string[] | undefined;

/**
 * Rootless network isolation prefix, probed once and cached. `unshare -rn`
 * runs the child in a fresh user+network namespace with no external interfaces
 * (loopback only), so generated code CANNOT reach the network. Returns [] when
 * `unshare` is unavailable (e.g. macOS) — see the runInSandbox @warning.
 */
function netIsolationPrefix(): string[] {
  if (netPrefixCache !== undefined) return netPrefixCache;
  try {
    const r = spawnSync("unshare", ["-rn", "--", "true"], { stdio: "ignore", timeout: 5000 });
    netPrefixCache = r.status === 0 ? ["unshare", "-rn", "--"] : [];
  } catch {
    netPrefixCache = [];
  }
  return netPrefixCache;
}

/** True when this host can enforce network isolation for the sandbox. */
export function hasNetIsolation(): boolean {
  return netIsolationPrefix().length > 0;
}

/**
 * Run untrusted code in a throwaway sandbox: write `files` into a fresh temp
 * dir, run `cmd` there with a minimal env (no inherited secrets), no network
 * (via `unshare -rn` when available), a hard wall-clock timeout that SIGKILLs
 * the whole process group, and guaranteed cleanup of the temp dir. The cwd is
 * the temp dir, never the repo working tree.
 *
 * `files` keys must be plain file names — `/`, `\` or `..` are rejected to
 * prevent path traversal out of the sandbox dir.
 *
 * @warning When `hasNetIsolation()` is false (no `unshare`), the child runs
 * WITHOUT network isolation. Do not run network-capable untrusted code on such
 * hosts; gate on `hasNetIsolation()` if that matters.
 */
export async function runInSandbox(
  files: Record<string, string>,
  cmd: string[],
  timeoutMs: number,
): Promise<{ ok: boolean; output: string }> {
  const dir = mkdtempSync(join(tmpdir(), "archon-sbx-"));
  try {
    for (const [name, content] of Object.entries(files)) {
      if (name.includes("/") || name.includes("\\") || name.includes("..")) {
        throw new Error(`Unsafe sandbox file name: ${JSON.stringify(name)}`);
      }
      writeFileSync(join(dir, name), content, "utf-8");
    }
    const full = [...netIsolationPrefix(), ...cmd];
    return await new Promise((resolve) => {
      const child = spawn(full[0], full.slice(1), {
        cwd: dir,
        env: { PATH: process.env.PATH ?? "", HOME: dir },
        stdio: ["ignore", "pipe", "pipe"],
        detached: true,
      });
      let out = "";
      let settled = false;
      const append = (d: Buffer) => {
        if (out.length < MAX_OUTPUT_CHARS) out += d.toString();
      };
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ ok, output: out.slice(0, MAX_OUTPUT_CHARS) });
      };
      const timer = setTimeout(() => {
        try {
          if (child.pid !== undefined) process.kill(-child.pid, "SIGKILL");
        } catch {
          child.kill("SIGKILL");
        }
        finish(false);
      }, timeoutMs);
      child.stdout.on("data", append);
      child.stderr.on("data", append);
      child.on("close", (code) => finish(code === 0));
      child.on("error", (e) => {
        append(Buffer.from(String(e)));
        finish(false);
      });
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
