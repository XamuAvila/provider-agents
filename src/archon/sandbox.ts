import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

/**
 * Run untrusted code in a throwaway sandbox: write `files` into a fresh temp
 * dir, run `cmd` there with a minimal env (no inherited secrets), a hard
 * wall-clock timeout that SIGKILLs the whole process group, and always clean up
 * the temp dir. The cwd is the temp dir, never the repo working tree.
 *
 * `detached: true` puts the child in its own process group so a timeout kill
 * (`-pid`) reaps grandchildren (e.g. pytest workers), not just the direct child.
 */
export async function runInSandbox(
  files: Record<string, string>,
  cmd: string[],
  timeoutMs: number,
): Promise<{ ok: boolean; output: string }> {
  const dir = mkdtempSync(join(tmpdir(), "archon-sbx-"));
  try {
    for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content, "utf-8");
    return await new Promise((resolve) => {
      const child = spawn(cmd[0], cmd.slice(1), {
        cwd: dir,
        env: { PATH: process.env.PATH ?? "", HOME: dir },
        stdio: ["ignore", "pipe", "pipe"],
        detached: true,
      });
      let out = "";
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ ok, output: out.slice(0, 8000) });
      };
      const timer = setTimeout(() => {
        try {
          if (child.pid !== undefined) process.kill(-child.pid, "SIGKILL");
        } catch {
          child.kill("SIGKILL");
        }
        finish(false);
      }, timeoutMs);
      child.stdout.on("data", (d) => (out += d));
      child.stderr.on("data", (d) => (out += d));
      child.on("close", (code) => finish(code === 0));
      child.on("error", (e) => {
        out += String(e);
        finish(false);
      });
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
