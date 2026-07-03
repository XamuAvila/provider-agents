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
      "  codex:",
      "    invocation: cli",
      "    command: codex exec",
      "    model: gpt-5.5",
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
  it("writes permission-only creds for claude-p profiles, skips cli, chmod 600", () => {
    const dir = setup();
    const written = generateCreds({
      profilesPath: join(dir, "profiles.yaml"),
      presetsPath: join(dir, "presets.yaml"),
      outDir: join(dir, "creds"),
    });
    const dsPath = join(dir, "creds", "deepseek.json");
    expect(written).toContain(dsPath);
    expect(written.some((p) => p.includes("codex"))).toBe(false); // cli skipped

    const cred = JSON.parse(readFileSync(dsPath, "utf-8"));
    expect(cred.$schema).toBe("https://json.schemastore.org/claude-code-settings.json");
    expect(cred.permissions.deny).toContain("Write");
    expect(cred.env).toBeUndefined(); // NO secret in generated cred
    expect(statSync(dsPath).mode & 0o777).toBe(0o600);
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
