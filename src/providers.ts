import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";

export interface ProviderDef {
  base_url: string;
  model: string;
  env?: Record<string, string>;
}

export interface Preset {
  allow?: string[];
  deny?: string[];
}

/** Absolute path to the repo's config/ dir, relative to this compiled module.
 *  `src/providers.ts` and the built `dist/providers.js` are both one level below
 *  the repo root, so `../config` resolves to the repo's config/ in dev and build. */
export function configDir(): string {
  return join(import.meta.dirname, "..", "config");
}

export function loadProviders(path: string): Record<string, ProviderDef> {
  const raw = yaml.load(readFileSync(path, "utf-8")) as
    | { providers?: Record<string, ProviderDef> }
    | null;
  return raw?.providers ?? {};
}

export function loadPresets(path: string): Record<string, Preset> {
  const raw = yaml.load(readFileSync(path, "utf-8")) as
    | { presets?: Record<string, Preset> }
    | null;
  return raw?.presets ?? {};
}

/** Secret store: provider -> { ANTHROPIC_AUTH_TOKEN, ... }. Missing file => {}. */
export function loadSecrets(path: string): Record<string, Record<string, string>> {
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, "utf-8")) as Record<
    string,
    Record<string, string>
  >;
}

/**
 * Build the process-env overlay for a provider: base URL + non-secret tuning env
 * + the secret token. This is the ONLY place the token is combined with config.
 * Never logs. Deliberately does NOT set ANTHROPIC_MODEL — model is passed via the
 * --model flag, and setting the env var would override/conflict with it.
 */
export function resolveProviderEnv(
  providerName: string,
  providers: Record<string, ProviderDef>,
  secrets: Record<string, Record<string, string>>,
): Record<string, string> {
  const provider = providers[providerName];
  if (!provider) {
    throw new Error(`unknown provider: ${providerName}`);
  }
  return {
    ANTHROPIC_BASE_URL: provider.base_url,
    ...(provider.env ?? {}),
    ...(secrets[providerName] ?? {}),
  };
}
