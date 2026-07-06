import { describe, it, expect, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  isAutoRecallEnabled,
  buildRecallPrompt,
  retrieveMemories,
  MEMORY_RETRIEVER_PROFILE,
} from "../src/memory-retrieval.js";
import { MEMORY_WRITER_PROFILE } from "../src/memory-hook.js";
import type { Config, SpawnResult, Profile } from "../src/types.js";

const retrieverProfile: Profile = {
  invocation: "claude-p",
  settings: "creds/readonly.json",
  model: "deepseek-v4-flash",
  provider: "deepseek",
  permissions: "readonly",
  description: "memory retriever",
};

function makeConfig(withRetriever = true): Config {
  const outputDir = mkdtempSync(join(tmpdir(), "pa-recall-"));
  const profiles: Record<string, Profile> = {
    explorer: {
      invocation: "claude-p",
      settings: "creds/no-write.json",
      model: "deepseek-v4-pro[1m]",
      description: "explorer",
    },
  };
  if (withRetriever) profiles[MEMORY_RETRIEVER_PROFILE] = retrieverProfile;
  return { defaults: { output_dir: outputDir }, profiles };
}

function makeMemoriesDir(): string {
  return mkdtempSync(join(tmpdir(), "pa-memdir-"));
}

function okResult(text: string): SpawnResult & { _text: string } {
  // The mock spawn writes nothing to disk; we stub readOutput via the output file
  // by returning a path the test's fake reader knows. Instead we inject text
  // through the spawn mock + a readOutput stub is not available, so retrieveMemories
  // reads the real file — the mock must write it. Simpler: the mock returns a path
  // to a temp file it created. Handled in each test below.
  return {
    status: "ok",
    exitCode: 0,
    outputPath: "/dev/null",
    profile: MEMORY_RETRIEVER_PROFILE,
    model: "deepseek-v4-flash",
    durationMs: 800,
    _text: text,
  };
}

describe("isAutoRecallEnabled", () => {
  it("defaults ON when unset", () => {
    expect(isAutoRecallEnabled({})).toBe(true);
  });
  it("OFF for disabling values", () => {
    for (const v of ["0", "false", "off", "no", "OFF"]) {
      expect(isAutoRecallEnabled({ PROVIDER_AGENTS_AUTO_RECALL: v })).toBe(false);
    }
  });
  it("ON for other values", () => {
    for (const v of ["1", "true", "yes", "on"]) {
      expect(isAutoRecallEnabled({ PROVIDER_AGENTS_AUTO_RECALL: v })).toBe(true);
    }
  });
});

describe("buildRecallPrompt", () => {
  it("embeds the topic and memories directory", () => {
    const memoriesDir = makeMemoriesDir();
    const p = buildRecallPrompt("how does the auth middleware work?", memoriesDir);
    expect(p).toContain("how does the auth middleware work?");
    expect(p).toContain(memoriesDir);
  });
});

describe("retrieveMemories — gating (no spawn)", () => {
  const cases: Array<[string, Parameters<typeof retrieveMemories>]> = [];

  it("skips when source profile is the retriever itself (loop guard)", async () => {
    const spawn = vi.fn();
    const res = await retrieveMemories(makeConfig(), MEMORY_RETRIEVER_PROFILE, "t", "/proj", {
      spawn,
      env: {},
      memoriesDir: makeMemoriesDir(),
      memoriesExist: () => true,
    });
    expect(res).toBeNull();
    expect(spawn).not.toHaveBeenCalled();
  });

  it("skips when source profile is the writer (loop/noise guard)", async () => {
    const spawn = vi.fn();
    const res = await retrieveMemories(makeConfig(), MEMORY_WRITER_PROFILE, "t", "/proj", {
      spawn,
      env: {},
      memoriesDir: makeMemoriesDir(),
      memoriesExist: () => true,
    });
    expect(res).toBeNull();
    expect(spawn).not.toHaveBeenCalled();
  });

  it("skips when disabled via env", async () => {
    const spawn = vi.fn();
    const res = await retrieveMemories(makeConfig(), "explorer", "t", "/proj", {
      spawn,
      env: { PROVIDER_AGENTS_AUTO_RECALL: "0" },
      memoriesExist: () => true,
    });
    expect(res).toBeNull();
    expect(spawn).not.toHaveBeenCalled();
  });

  it("skips when no retriever profile is configured", async () => {
    const spawn = vi.fn();
    const res = await retrieveMemories(makeConfig(false), "explorer", "t", "/proj", {
      spawn,
      env: {},
      memoriesDir: makeMemoriesDir(),
      memoriesExist: () => true,
    });
    expect(res).toBeNull();
    expect(spawn).not.toHaveBeenCalled();
  });

  it("skips when the memories/ dir does not exist", async () => {
    const spawn = vi.fn();
    const res = await retrieveMemories(makeConfig(), "explorer", "t", "/proj", {
      spawn,
      env: {},
      memoriesExist: () => false,
    });
    expect(res).toBeNull();
    expect(spawn).not.toHaveBeenCalled();
  });
});

describe("retrieveMemories — spawn behavior", () => {
  it("returns found=true with the retriever text when memories are relevant", async () => {
    const config = makeConfig();
    const spawn = vi.fn(async (_p, _n, _prompt, outputPath: string) => {
      const { writeFileSync } = await import("node:fs");
      writeFileSync(outputPath, "- memories/auth.md: the middleware uses `<` not `<=`");
      return { ...okResult("x"), outputPath };
    });
    const res = await retrieveMemories(config, "explorer", "auth middleware", "/proj", {
      spawn: spawn as never,
      env: {},
      memoriesDir: makeMemoriesDir(),
      memoriesExist: () => true,
    });
    expect(res).not.toBeNull();
    expect(res!.found).toBe(true);
    expect(res!.text).toContain("memories/auth.md");
    const [profileArg, nameArg, , , , cwdArg] = spawn.mock.calls[0];
    expect(profileArg).toBe(retrieverProfile);
    expect(nameArg).toBe(MEMORY_RETRIEVER_PROFILE);
    expect(cwdArg).toBe("/proj");
  });

  it("returns found=false when the retriever reports none", async () => {
    const config = makeConfig();
    const spawn = vi.fn(async (_p, _n, _prompt, outputPath: string) => {
      const { writeFileSync } = await import("node:fs");
      writeFileSync(outputPath, "NENHUMA memória relevante.");
      return { ...okResult("x"), outputPath };
    });
    const res = await retrieveMemories(config, "explorer", "unrelated topic", "/proj", {
      spawn: spawn as never,
      env: {},
      memoriesDir: makeMemoriesDir(),
      memoriesExist: () => true,
    });
    expect(res).not.toBeNull();
    expect(res!.found).toBe(false);
  });

  it("returns null when the retriever spawn did not succeed", async () => {
    const config = makeConfig();
    const spawn = vi.fn(async () => ({ ...okResult("x"), status: "error" as const }));
    const res = await retrieveMemories(config, "explorer", "t", "/proj", {
      spawn: spawn as never,
      env: {},
      memoriesDir: makeMemoriesDir(),
      memoriesExist: () => true,
    });
    expect(res).toBeNull();
  });
});
