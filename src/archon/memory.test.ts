// src/archon/memory.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  resolveVaultDir, writeTrace, readRecentTraces, readPolicy, writePolicy,
} from "./memory.js";
import type { Trace, Policy } from "./types.js";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "vault-")); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

const trace = (id: string, createdAt = "2026-06-23T00:00:00.000Z"): Trace => ({
  id, task: "t " + id, taskTags: ["ts"], turns: [], accepted: true, score: 1, createdAt,
});

describe("memory", () => {
  it("resolveVaultDir honors the env override", () => {
    expect(resolveVaultDir({ PROVIDER_AGENTS_VAULT: "/x/y" } as NodeJS.ProcessEnv))
      .toBe("/x/y");
  });

  it("round-trips a trace through markdown", () => {
    writeTrace(trace("a"), dir);
    const got = readRecentTraces(dir, 10);
    expect(got).toHaveLength(1);
    expect(got[0].id).toBe("a");
    expect(got[0].taskTags).toEqual(["ts"]);
    expect(got[0].accepted).toBe(true);
    expect(got[0].task).toBe("t a");
    expect(got[0].score).toBe(1);
    expect(got[0].createdAt).toBe("2026-06-23T00:00:00.000Z");
  });

  it("readRecentTraces returns newest first, capped by limit", () => {
    writeTrace(trace("a", "2026-06-23T00:00:01.000Z"), dir);
    writeTrace(trace("b", "2026-06-23T00:00:02.000Z"), dir);
    writeTrace(trace("c", "2026-06-23T00:00:03.000Z"), dir);
    const got = readRecentTraces(dir, 2);
    expect(got.map((t) => t.id)).toEqual(["c", "b"]);
  });

  it("readPolicy returns an empty policy when none exists, then round-trips", () => {
    expect(readPolicy(dir).version).toBe(0);
    const p: Policy = {
      version: 3,
      rules: [{ when: "ts", forRole: "worker", preferProfile: "coder", rationale: "r" }],
      notes: "n", updatedAt: "2026-06-23T00:00:00.000Z",
    };
    writePolicy(p, dir);
    const got = readPolicy(dir);
    expect(got.version).toBe(3);
    expect(got.rules[0].preferProfile).toBe("coder");
  });
});
