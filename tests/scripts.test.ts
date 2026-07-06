import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  validateScriptName,
  listScripts,
  getScript,
  writeScript,
  removeScript,
  scriptExists,
  resolveScriptPaths,
  appendScriptReferences,
  runScript,
} from "../src/scripts.js";

function tmpDir(): string {
  return mkdtempSync(join(tmpdir(), "pa-scripts-"));
}

describe("validateScriptName — trust boundary", () => {
  it("accepts plain filenames", () => {
    for (const n of ["backup.sh", "deploy", "a_b-c.1.ts"]) {
      expect(() => validateScriptName(n)).not.toThrow();
    }
  });
  it("rejects path separators, traversal, and empties", () => {
    for (const n of ["../evil.sh", "a/b.sh", "..", ".hidden", "", "a\\b"]) {
      expect(() => validateScriptName(n)).toThrow();
    }
  });
});

describe("writeScript / getScript / listScripts / removeScript", () => {
  it("writes an executable file and reads it back", () => {
    const dir = tmpDir();
    const info = writeScript("hello.sh", "#!/usr/bin/env bash\n# description: says hi\necho hi\n", dir);
    expect(info.name).toBe("hello.sh");
    expect(info.description).toBe("says hi");
    expect(existsSync(info.path)).toBe(true);
    // chmod 0o755 → owner-executable bit set
    expect(statSync(info.path).mode & 0o100).toBe(0o100);
    expect(getScript("hello.sh", dir)).toContain("echo hi");
  });

  it("lists scripts with descriptions, skipping dotfiles", () => {
    const dir = tmpDir();
    writeScript("a.sh", "#!/usr/bin/env bash\n# description: alpha\n", dir);
    writeScript("b.sh", "#!/usr/bin/env bash\necho no-desc\n", dir);
    writeFileSync(join(dir, ".hidden"), "x");
    writeFileSync(join(dir, "README.md"), "# docs, not a script");
    const list = listScripts(dir);
    expect(list.map((s) => s.name)).toEqual(["a.sh", "b.sh"]);
    expect(list[0].description).toBe("alpha");
    expect(list[1].description).toBe("");
  });

  it("removeScript deletes and returns false when absent", () => {
    const dir = tmpDir();
    writeScript("x.sh", "#!/usr/bin/env bash\n", dir);
    expect(removeScript("x.sh", dir)).toBe(true);
    expect(scriptExists("x.sh", dir)).toBe(false);
    expect(removeScript("x.sh", dir)).toBe(false);
  });

  it("rejects oversized content", () => {
    const dir = tmpDir();
    expect(() => writeScript("big.sh", "x".repeat(300 * 1024), dir)).toThrow(/limit/);
  });

  it("resolveScriptPaths returns only existing registered scripts", () => {
    const dir = tmpDir();
    writeScript("real.sh", "#!/usr/bin/env bash\n", dir);
    const paths = resolveScriptPaths(["real.sh", "ghost.sh", "../evil"], dir);
    expect(paths).toHaveLength(1);
    expect(paths[0]).toContain("real.sh");
  });

  it("appends existing script paths and descriptions to a prompt", () => {
    const dir = tmpDir();
    writeScript("facts.sh", "#!/bin/sh\n# description: collect facts\n", dir);
    const prompt = appendScriptReferences("task", ["facts.sh", "missing.sh"], dir);
    expect(prompt).toContain("task");
    expect(prompt).toContain("facts.sh");
    expect(prompt).toContain("collect facts");
    expect(prompt).not.toContain("missing.sh");
  });
});

describe("runScript", () => {
  it("runs a registered script and captures stdout + exit code", async () => {
    const dir = tmpDir();
    writeScript("echoer.sh", "#!/usr/bin/env bash\necho \"out:$1\"\n", dir);
    const r = await runScript("echoer.sh", ["hi"], { dir });
    expect(r.status).toBe("ok");
    expect(r.exitCode).toBe(0);
    expect(r.stdout.trim()).toBe("out:hi");
  });

  it("reports non-zero exit as error", async () => {
    const dir = tmpDir();
    writeScript("fail.sh", "#!/usr/bin/env bash\nexit 3\n", dir);
    const r = await runScript("fail.sh", [], { dir });
    expect(r.status).toBe("error");
    expect(r.exitCode).toBe(3);
  });

  it("returns 127 for an unregistered script (never spawns)", async () => {
    const dir = tmpDir();
    const r = await runScript("nope.sh", [], { dir });
    expect(r.status).toBe("error");
    expect(r.exitCode).toBe(127);
  });

  it("generates a Mermaid debugging HTML under /tmp", async () => {
    const dir = tmpDir();
    const source = join(dir, "debug.mmd");
    const output = join(dir, "debug.html");
    writeFileSync(source, "flowchart LR\n  A[Request] --> B{Valid?}\n  B -->|No| C[Error]\n");
    const r = await runScript("mermaid-debug-html.mjs", [source, output, "Debug flow"]);
    expect(r.status).toBe("ok");
    expect(readFileSync(output, "utf8")).toContain('<pre class="mermaid diagram">');
    expect(readFileSync(output, "utf8")).toContain("A[Request] --&gt; B{Valid?}");
  });

  it("rejects Mermaid HTML output outside /tmp", async () => {
    const dir = tmpDir();
    const source = join(dir, "debug.mmd");
    writeFileSync(source, "flowchart LR\n  A --> B\n");
    const r = await runScript("mermaid-debug-html.mjs", [source, resolve(dir, "../outside.html").replace("/tmp/", "/var/tmp/")]);
    expect(r.status).toBe("error");
    expect(r.exitCode).toBe(2);
  });
});
