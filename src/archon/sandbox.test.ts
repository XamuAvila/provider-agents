import { describe, it, expect } from "vitest";
import { runInSandbox, hasNetIsolation } from "./sandbox.js";

// Light integration test of the sandbox component itself (the one place real
// execution is justified). Uses `node` so it needs no python3. Fast: the
// processes exit immediately or are killed by the timeout.
describe("runInSandbox (integration)", () => {
  it("reports ok=true on exit 0", async () => {
    const r = await runInSandbox({ "n.js": "process.exit(0)" }, ["node", "n.js"], 5000);
    expect(r.ok).toBe(true);
  });

  it("reports ok=false on non-zero exit", async () => {
    const r = await runInSandbox({ "n.js": "process.exit(3)" }, ["node", "n.js"], 5000);
    expect(r.ok).toBe(false);
  });

  it("captures stdout/stderr", async () => {
    const r = await runInSandbox({ "n.js": "console.log('hi'); console.error('bye')" }, ["node", "n.js"], 5000);
    expect(r.output).toContain("hi");
    expect(r.output).toContain("bye");
  });

  it("kills a process that exceeds the timeout (ok=false)", async () => {
    const r = await runInSandbox({ "n.js": "setTimeout(() => {}, 100000)" }, ["node", "n.js"], 300);
    expect(r.ok).toBe(false);
  });

  it("rejects path-traversal file names", async () => {
    await expect(runInSandbox({ "../evil.js": "0" }, ["node", "n.js"], 5000)).rejects.toThrow(
      /Unsafe sandbox file name/,
    );
  });

  it("blocks network access when isolation is available", async () => {
    if (!hasNetIsolation()) return; // host cannot isolate (e.g. macOS) — nothing to assert
    const code =
      "const s=require('net').createConnection({host:'1.1.1.1',port:53});" +
      "s.setTimeout(2500);s.on('connect',()=>process.exit(0));" +
      "s.on('error',()=>process.exit(7));s.on('timeout',()=>process.exit(7));";
    const r = await runInSandbox({ "n.js": code }, ["node", "n.js"], 6000);
    expect(r.ok).toBe(false); // connection refused/unreachable -> non-zero exit
  });
});
