import { describe, it, expect, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  isAutoMemoryEnabled,
  buildMemoryPrompt,
  persistMemoryHook,
  MEMORY_WRITER_PROFILE,
} from "../src/memory-hook.js";
import type { Config, SpawnResult, Profile } from "../src/types.js";

const memProfile: Profile = {
  invocation: "claude-p",
  settings: "creds/write-md.json",
  model: "deepseek-v4-flash",
  provider: "deepseek",
  permissions: "write-md",
  description: "memory scribe",
};

function makeConfig(withMemory = true): Config {
  const outputDir = mkdtempSync(join(tmpdir(), "pa-mem-"));
  const profiles: Record<string, Profile> = {
    explorer: {
      invocation: "claude-p",
      settings: "creds/no-write.json",
      model: "deepseek-v4-pro[1m]",
      description: "explorer",
    },
  };
  if (withMemory) profiles[MEMORY_WRITER_PROFILE] = memProfile;
  return { defaults: { output_dir: outputDir }, profiles };
}

function makeMemoriesDir(): string {
  return mkdtempSync(join(tmpdir(), "pa-memdir-"));
}

function okResult(overrides: Partial<SpawnResult> = {}): SpawnResult {
  return {
    status: "ok",
    exitCode: 0,
    outputPath: "/tmp/provider-agents/20260703-explorer.md",
    profile: "explorer",
    model: "deepseek-v4-pro[1m]",
    durationMs: 1234,
    ...overrides,
  };
}

describe("isAutoMemoryEnabled", () => {
  it("defaults to ON when the env var is unset", () => {
    expect(isAutoMemoryEnabled({})).toBe(true);
  });

  it("is OFF for disabling values (0/false/off/no, case-insensitive)", () => {
    for (const v of ["0", "false", "off", "no", "FALSE", "Off", " no "]) {
      expect(isAutoMemoryEnabled({ PROVIDER_AGENTS_AUTO_MEMORY: v })).toBe(false);
    }
  });

  it("stays ON for any other value", () => {
    for (const v of ["1", "true", "on", "yes", "anything"]) {
      expect(isAutoMemoryEnabled({ PROVIDER_AGENTS_AUTO_MEMORY: v })).toBe(true);
    }
  });
});

describe("buildMemoryPrompt", () => {
  it("references the source profile, the task, and the output file path", () => {
    const memoriesDir = makeMemoriesDir();
    const prompt = buildMemoryPrompt("explorer", "map all call sites of foo()", okResult(), memoriesDir);
    expect(prompt).toContain("explorer");
    expect(prompt).toContain("map all call sites of foo()");
    expect(prompt).toContain("/tmp/provider-agents/20260703-explorer.md");
    expect(prompt).toContain(memoriesDir);
  });
});

describe("persistMemoryHook", () => {
  it("fires the memory-writer for a successful non-memory spawn", () => {
    const config = makeConfig();
    const memoriesDir = makeMemoriesDir();
    const spawn = vi.fn().mockResolvedValue(okResult({ profile: MEMORY_WRITER_PROFILE }));

    const triggered = persistMemoryHook(config, "explorer", "the task", okResult(), "/proj", {
      spawn,
      env: {},
      memoriesDir,
    });

    expect(triggered).toBe(true);
    expect(spawn).toHaveBeenCalledTimes(1);
    const [profileArg, nameArg, promptArg, , extraArgs, cwdArg] = spawn.mock.calls[0];
    expect(profileArg).toBe(memProfile);
    expect(nameArg).toBe(MEMORY_WRITER_PROFILE);
    expect(promptArg).toContain("the task");
    expect(promptArg).toContain(memoriesDir);
    expect(extraArgs).toEqual(["--add-dir", config.defaults.output_dir]);
    expect(cwdArg).toBe("/proj");
  });

  it("does NOT fire when the source profile is the memory-writer (loop guard)", () => {
    const config = makeConfig();
    const spawn = vi.fn();
    const triggered = persistMemoryHook(
      config,
      MEMORY_WRITER_PROFILE,
      "t",
      okResult({ profile: MEMORY_WRITER_PROFILE }),
      "/proj",
      { spawn, env: {}, memoriesDir: makeMemoriesDir() },
    );
    expect(triggered).toBe(false);
    expect(spawn).not.toHaveBeenCalled();
  });

  it("does NOT fire when auto-memory is disabled via env", () => {
    const config = makeConfig();
    const spawn = vi.fn();
    const triggered = persistMemoryHook(config, "explorer", "t", okResult(), "/proj", {
      spawn,
      env: { PROVIDER_AGENTS_AUTO_MEMORY: "0" },
      memoriesDir: makeMemoriesDir(),
    });
    expect(triggered).toBe(false);
    expect(spawn).not.toHaveBeenCalled();
  });

  it("does NOT fire when the source spawn did not succeed", () => {
    const config = makeConfig();
    const spawn = vi.fn();
    for (const status of ["error", "timeout"] as const) {
      const triggered = persistMemoryHook(config, "explorer", "t", okResult({ status }), "/proj", {
        spawn,
        env: {},
        memoriesDir: makeMemoriesDir(),
      });
      expect(triggered).toBe(false);
    }
    expect(spawn).not.toHaveBeenCalled();
  });

  it("does NOT fire when no memory-writer profile is configured", () => {
    const config = makeConfig(false);
    const spawn = vi.fn();
    const triggered = persistMemoryHook(config, "explorer", "t", okResult(), "/proj", {
      spawn,
      env: {},
      memoriesDir: makeMemoriesDir(),
    });
    expect(triggered).toBe(false);
    expect(spawn).not.toHaveBeenCalled();
  });

  it("swallows a rejected memory spawn without throwing (fire-and-forget)", async () => {
    const config = makeConfig();
    const spawn = vi.fn().mockRejectedValue(new Error("boom"));
    // Must not throw synchronously nor reject the caller.
    const triggered = persistMemoryHook(config, "explorer", "t", okResult(), "/proj", {
      spawn,
      env: {},
      memoriesDir: makeMemoriesDir(),
    });
    expect(triggered).toBe(true);
    // let the rejected promise settle; the .catch must absorb it.
    await new Promise((r) => setTimeout(r, 0));
  });
});
