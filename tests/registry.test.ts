import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseDocument } from "yaml";
import {
  upsertGlobalProfileRaw,
  deleteGlobalProfile,
  readGlobalProfileRaw,
  REGISTRY_STRINGIFY,
} from "../src/registry.js";

// A curated registry with header + per-profile comments — the exact thing a
// naive js-yaml dump would destroy.
const CURATED = `# === Registry curado ===
# Comentário de topo que NÃO pode sumir.
profiles:
  # explorer: agente de busca
  explorer:
    invocation: claude-p
    model: deepseek-v4-pro[1m]
    provider: deepseek
    permissions: no-write
    description: Explorador de código.
`;

function tmpRegistry(content = CURATED): string {
  const dir = mkdtempSync(join(tmpdir(), "pa-reg-"));
  const path = join(dir, "profiles.yaml");
  writeFileSync(path, content, "utf-8");
  return path;
}

describe("upsertGlobalProfileRaw — comment preservation", () => {
  it("adds a new profile while preserving header + existing comments", () => {
    const path = tmpRegistry();
    const res = upsertGlobalProfileRaw(
      "newbie",
      {
        invocation: "claude-p",
        model: "deepseek-v4-flash",
        provider: "deepseek",
        permissions: "readonly",
        description: "Novo agente.",
      },
      path,
    );
    const out = readFileSync(path, "utf-8");

    expect(res.created).toBe(true);
    // curated comments survive
    expect(out).toContain("# === Registry curado ===");
    expect(out).toContain("# Comentário de topo que NÃO pode sumir.");
    expect(out).toContain("# explorer: agente de busca");
    // both profiles present
    expect(out).toContain("explorer:");
    expect(out).toContain("newbie:");
    expect(out).toContain("Novo agente.");
  });

  it("updates an existing profile in place (created=false), comments intact", () => {
    const path = tmpRegistry();
    const res = upsertGlobalProfileRaw(
      "explorer",
      {
        invocation: "claude-p",
        model: "deepseek-v4-flash",
        provider: "deepseek",
        permissions: "readonly",
        description: "Explorador ATUALIZADO.",
      },
      path,
    );
    const out = readFileSync(path, "utf-8");

    expect(res.created).toBe(false);
    expect(out).toContain("# === Registry curado ===");
    expect(out).toContain("Explorador ATUALIZADO.");
    expect(out).toContain("deepseek-v4-flash");
    // not duplicated
    expect(out.match(/^\s*explorer:/gm)?.length).toBe(1);
  });

  it("creates the file + profiles map when absent", () => {
    const dir = mkdtempSync(join(tmpdir(), "pa-reg-empty-"));
    const path = join(dir, "profiles.yaml");
    const res = upsertGlobalProfileRaw(
      "solo",
      { invocation: "claude-p", model: "m", description: "d" },
      path,
    );
    const out = readFileSync(path, "utf-8");
    expect(res.created).toBe(true);
    expect(out).toContain("solo:");
  });
});

describe("deleteGlobalProfile", () => {
  it("removes a profile, keeps the rest + comments", () => {
    const twoProfiles = CURATED + `  reviewer:
    invocation: claude-p
    model: deepseek-v4-pro[1m]
    description: Revisor.
`;
    const path = tmpRegistry(twoProfiles);
    const removed = deleteGlobalProfile("explorer", path);
    const out = readFileSync(path, "utf-8");

    expect(removed).toBe(true);
    expect(out).not.toMatch(/^\s*explorer:/m);
    expect(out).toContain("reviewer:");
    expect(out).toContain("# === Registry curado ===");
  });

  it("returns false for a missing profile", () => {
    const path = tmpRegistry();
    expect(deleteGlobalProfile("ghost", path)).toBe(false);
  });
});

describe("byte-stable round-trip (real registry)", () => {
  it("re-emits config/profiles.yaml byte-identically (guards against folded >- blocks)", () => {
    // The whole point of REGISTRY_STRINGIFY: an unchanged round-trip must be
    // byte-identical, so every write only diffs the touched profile. If someone
    // adds a folded `>-` system_prompt (which re-wraps on emit), this fails.
    const real = join(import.meta.dirname, "..", "config", "profiles.yaml");
    const src = readFileSync(real, "utf-8");
    const out = parseDocument(src).toString(REGISTRY_STRINGIFY);
    expect(out).toBe(src);
  });
});

describe("readGlobalProfileRaw", () => {
  it("returns the raw profile object or null", () => {
    const path = tmpRegistry();
    const p = readGlobalProfileRaw("explorer", path);
    expect(p?.model).toBe("deepseek-v4-pro[1m]");
    expect(p?.permissions).toBe("no-write");
    expect(readGlobalProfileRaw("ghost", path)).toBeNull();
  });
});
