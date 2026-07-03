/**
 * Comment-preserving CRUD over the GLOBAL profile registry
 * (`<repo>/config/profiles.yaml`, resolved via globalConfigDir()).
 *
 * The registry is hand-curated with header comments, per-profile comments, and
 * multi-line system_prompts. A js-yaml load→dump round-trip drops ALL comments,
 * so writes here go through the `yaml` package's Document API, which round-trips
 * comments and formatting (verified via Context7 /eemeli/yaml). Reads elsewhere
 * stay on js-yaml (loadConfig) — only writes need preservation.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseDocument, type Document } from "yaml";
import { globalConfigDir } from "./config.js";

export function globalRegistryPath(): string {
  return join(globalConfigDir(), "profiles.yaml");
}

// Stringify options tuned so an unchanged round-trip is byte-stable against the
// curated registry: `lineWidth: 0` disables re-wrapping (literal `|-` blocks and
// long descriptions stay verbatim); `flowCollectionPadding: false` keeps
// `tags: [a, b]` without inner padding. This confines every write's diff to the
// profile actually touched. (Requires all system_prompt blocks to be literal
// `|-`, not folded `>-`, which fold-collapse on re-emit.)
export const REGISTRY_STRINGIFY = { lineWidth: 0, flowCollectionPadding: false } as const;

function loadDoc(path: string): Document.Parsed {
  const src = existsSync(path) ? readFileSync(path, "utf-8") : "profiles:\n";
  const doc = parseDocument(src);
  // Guarantee a `profiles:` map exists so setIn(["profiles", name], ...) works
  // even on an empty/absent file.
  if (!doc.hasIn(["profiles"]) || doc.getIn(["profiles"]) == null) {
    doc.setIn(["profiles"], doc.createNode({}));
  }
  return doc;
}

/**
 * Create or update a profile by name in the registry, preserving all existing
 * comments/formatting. `raw` is the profile body (no name key). Returns whether
 * the profile was newly created (vs updated).
 */
export function upsertGlobalProfileRaw(
  name: string,
  raw: Record<string, unknown>,
  path: string = globalRegistryPath(),
): { created: boolean } {
  const doc = loadDoc(path);
  const existed = doc.hasIn(["profiles", name]);
  doc.setIn(["profiles", name], doc.createNode(raw));
  writeFileSync(path, doc.toString(REGISTRY_STRINGIFY), "utf-8");
  return { created: !existed };
}

/** Delete a profile by name. Returns false when it did not exist. */
export function deleteGlobalProfile(
  name: string,
  path: string = globalRegistryPath(),
): boolean {
  if (!existsSync(path)) return false;
  const doc = parseDocument(readFileSync(path, "utf-8"));
  if (!doc.hasIn(["profiles", name])) return false;
  doc.deleteIn(["profiles", name]);
  writeFileSync(path, doc.toString(REGISTRY_STRINGIFY), "utf-8");
  return true;
}

/** Read a single profile's raw body (as plain JS), or null when absent. */
export function readGlobalProfileRaw(
  name: string,
  path: string = globalRegistryPath(),
): Record<string, unknown> | null {
  if (!existsSync(path)) return null;
  const doc = parseDocument(readFileSync(path, "utf-8"));
  if (!doc.hasIn(["profiles", name])) return null;
  const node = doc.getIn(["profiles", name]);
  const value = node && typeof (node as { toJSON?: unknown }).toJSON === "function"
    ? (node as { toJSON: () => unknown }).toJSON()
    : node;
  return (value as Record<string, unknown>) ?? null;
}
