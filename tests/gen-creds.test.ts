import { describe, it, expect } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { generateCreds } from "../scripts/gen-creds.js";

function setup(): string {
  const dir = mkdtempSync(join(tmpdir(), "genc-"));
  mkdirSync(join(dir, "creds"), { recursive: true });
  writeFileSync(
    join(dir, "profiles.yaml"),
    [
      "profiles:",
      "  deepseek:",
      "    invocation: claude-p",
      "    model: deepseek-v4-pro[1m]",
      "    provider: deepseek",
      "    permissions: no-write",
      "    description: d",
      "  pplx:",
      "    invocation: cli",
      "    command: pplx",
      "    model: sonar-pro",
      "    description: c",
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(dir, "presets.yaml"),
    ["presets:", "  no-write:", "    deny: [Write, Edit, 'Read(**/.env)']", ""].join("\n"),
  );
  return dir;
}

describe("generateCreds", () => {
  it("writes ONE permission-only cred per used preset, skips cli, chmod 600", () => {
    const dir = setup();
    const written = generateCreds({
      profilesPath: join(dir, "profiles.yaml"),
      presetsPath: join(dir, "presets.yaml"),
      outDir: join(dir, "creds"),
    });
    // Keyed by preset, not profile name: deepseek uses no-write -> creds/no-write.json
    const presetPath = join(dir, "creds", "no-write.json");
    expect(written).toEqual([presetPath]); // single distinct preset used
    expect(written.some((p) => p.includes("deepseek"))).toBe(false); // not per-profile
    expect(written.some((p) => p.includes("pplx"))).toBe(false); // cli skipped

    const cred = JSON.parse(readFileSync(presetPath, "utf-8"));
    expect(cred.$schema).toBe("https://json.schemastore.org/claude-code-settings.json");
    expect(cred.permissions.deny).toContain("Write");
    expect(cred.env).toBeUndefined(); // NO secret in generated cred
    expect(statSync(presetPath).mode & 0o777).toBe(0o600);
  });

  it("throws when a profile references an unknown preset", () => {
    const dir = setup();
    writeFileSync(join(dir, "presets.yaml"), "presets: {}\n");
    expect(() =>
      generateCreds({
        profilesPath: join(dir, "profiles.yaml"),
        presetsPath: join(dir, "presets.yaml"),
        outDir: join(dir, "creds"),
      }),
    ).toThrow(/unknown permission preset/i);
  });
});
