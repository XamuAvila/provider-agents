import { describe, it, expect } from "vitest";
import { runInSandbox } from "./sandbox.js";

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
});
