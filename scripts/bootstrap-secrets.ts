/**
 * One-time migration: extract each provider's ANTHROPIC_AUTH_TOKEN from the
 * legacy per-profile creds and write them to config/creds/secrets.json.
 * NEVER prints token values. Run once by the operator, then chmod 600.
 *
 * Usage: npx tsx scripts/bootstrap-secrets.ts
 */
import { readFileSync, writeFileSync, existsSync, chmodSync } from "node:fs";
import { join } from "node:path";

const CREDS = join(import.meta.dirname, "..", "config", "creds");

// provider name -> legacy cred file to lift the token from.
const SOURCES: Record<string, string> = {
  deepseek: "deepseek.json",
  moonshot: "kimi.json",
};

function tokenFrom(file: string): string | undefined {
  const p = join(CREDS, file);
  if (!existsSync(p)) return undefined;
  const env = (JSON.parse(readFileSync(p, "utf-8")).env ?? {}) as Record<
    string,
    string
  >;
  return env.ANTHROPIC_AUTH_TOKEN;
}

const out = join(CREDS, "secrets.json");

// Idempotent: merge into any existing secrets.json and NEVER overwrite a present
// token with a missing one. gen-creds overwrites the legacy <provider>.json with a
// permission-only file, so a second run would otherwise find no token there and
// clobber a good secrets.json — this guard prevents that.
const secrets: Record<string, Record<string, string>> = existsSync(out)
  ? (JSON.parse(readFileSync(out, "utf-8")) as Record<string, Record<string, string>>)
  : {};

for (const [provider, file] of Object.entries(SOURCES)) {
  const token = tokenFrom(file);
  if (token) {
    secrets[provider] = { ...(secrets[provider] ?? {}), ANTHROPIC_AUTH_TOKEN: token };
    console.log(`bootstrapped token for provider "${provider}" (value redacted)`);
  } else if (secrets[provider]?.ANTHROPIC_AUTH_TOKEN) {
    console.log(`kept existing token for provider "${provider}" (legacy source ${file} gone)`);
  } else {
    console.log(
      `no token found for provider "${provider}" (source ${file} missing/empty) — skipped`,
    );
  }
}

writeFileSync(out, JSON.stringify(secrets, null, 2) + "\n", "utf-8");
chmodSync(out, 0o600);
console.log(
  `wrote ${out} with providers: ${Object.keys(secrets).join(", ") || "none"} (chmod 600)`,
);
