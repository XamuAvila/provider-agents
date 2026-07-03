/**
 * Generator: build per-profile permission-only creds from profiles.yaml +
 * permission-presets.yaml. Output creds contain ONLY `permissions` — no secret.
 * The token is injected at spawn time from config/creds/secrets.json (see
 * src/spawner.ts). Regenerate after editing profiles/presets.
 *
 * Usage: npx tsx scripts/gen-creds.ts
 */
import { writeFileSync, chmodSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../src/config.js";
import { loadPresets, configDir } from "../src/providers.js";

const SCHEMA = "https://json.schemastore.org/claude-code-settings.json";

export interface GenOpts {
  profilesPath: string;
  presetsPath: string;
  outDir: string;
}

export function generateCreds(opts: GenOpts): string[] {
  const config = loadConfig(opts.profilesPath);
  const presets = loadPresets(opts.presetsPath);
  mkdirSync(opts.outDir, { recursive: true });

  const written: string[] = [];
  for (const [name, profile] of Object.entries(config.profiles)) {
    if (profile.invocation !== "claude-p") continue;
    const presetName = profile.permissions;
    if (!presetName) continue; // no preset -> no generated cred
    const preset = presets[presetName];
    if (!preset) {
      throw new Error(
        `profile "${name}" references unknown permission preset "${presetName}"`,
      );
    }
    const out = join(opts.outDir, `${name}.json`);
    const body = { $schema: SCHEMA, permissions: preset };
    writeFileSync(out, JSON.stringify(body, null, 2) + "\n", "utf-8");
    chmodSync(out, 0o600);
    written.push(out);
  }
  return written;
}

// CLI entrypoint: run against the repo's real config when invoked directly.
if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = configDir();
  const written = generateCreds({
    profilesPath: join(dir, "profiles.yaml"),
    presetsPath: join(dir, "permission-presets.yaml"),
    outDir: join(dir, "creds"),
  });
  console.log(`generated ${written.length} cred(s):`);
  for (const p of written) console.log(`  ${p}`);
}
