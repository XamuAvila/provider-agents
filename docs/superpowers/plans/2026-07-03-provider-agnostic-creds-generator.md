# Provider-Agnostic Creds Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make provider-agents provider-agnostic with spawn-time provider selection, driven by a single unified key, generating per-profile permission-only creds from the YAML source.

**Architecture:** Split the two orthogonal axes currently fused in `creds/*.json`: `permissions` (per-role, generated into `creds/<profile>.json` — no secret) and provider `env` (per-provider, injected into the child process env at spawn from a single secrets store). A generator script builds the permission files from `profiles.yaml` + `permission-presets.yaml`; the spawner resolves the provider (default per-profile, overridable per spawn) and injects `ANTHROPIC_AUTH_TOKEN`/`ANTHROPIC_BASE_URL` from `secrets.json`.

**Tech Stack:** TypeScript (ESM, `.js` import specifiers), Vitest, js-yaml, Node child_process. Runtime: `claude -p` with `--settings` + `--model` + injected env.

## Global Constraints

- **Language:** system prompts, code comments, and code identifiers stay in English. User-facing prose (commits, reports) in pt-BR.
- **Secrets:** the token lives in exactly ONE file — `config/creds/secrets.json` (gitignored, chmod 600). NEVER printed, echoed, or logged. Generated `creds/<profile>.json` files contain ONLY `permissions` — no secret.
- **`$schema` constant:** every generated cred and preset-consuming file uses `"https://json.schemastore.org/claude-code-settings.json"`.
- **Behavior-preserving refactor:** every existing profile keeps provider `deepseek` and permissions identical to today. `coder` stays on the `no-write` preset (pre-existing bug preserved, NOT fixed here — documented follow-up).
- **`mcp_config` stays in YAML** (settings.json has no `mcpServers`); `allowed_tools` is removed from YAML and absorbed into permission presets.
- **Model resolution:** the generator does NOT put `ANTHROPIC_MODEL` in provider env (avoids conflict with the `--model` flag). Model comes from the `--model` flag only. Provider-tuning `ANTHROPIC_DEFAULT_*_MODEL` keys DO stay in provider env.
- All tests run with `npm test` (Vitest). Show output before marking a task complete.

---

### Task 1: Source config — providers.yaml + permission-presets.yaml

**Files:**
- Create: `config/providers.yaml`
- Create: `config/permission-presets.yaml`
- Test: `tests/providers.test.ts` (parse assertions only, in this task)

**Interfaces:**
- Produces: `config/providers.yaml` with top-level `providers: Record<string, {base_url, model, env?}>`; `config/permission-presets.yaml` with top-level `presets: Record<string, {allow?: string[], deny?: string[]}>`. These exact shapes are consumed by Task 2.

**Context:** These are TRACKED, non-secret source files. Values are copied verbatim from the current `config/creds/*.json` (env minus the token; permission blocks as-is). The token is NOT in either file.

- [ ] **Step 1: Write `config/providers.yaml`**

```yaml
# Provider registry (NÃO-secreto, versionado).
# base_url + model default + env de tuning por provider. O TOKEN não vive aqui —
# fica em config/creds/secrets.json (gitignored). O gerador e o spawner leem daqui.
providers:
  deepseek:
    base_url: https://api.deepseek.com/anthropic
    model: deepseek-v4-pro[1m]
    env:
      ANTHROPIC_DEFAULT_HAIKU_MODEL: deepseek-v4-pro
      ANTHROPIC_DEFAULT_SONNET_MODEL: deepseek-v4-pro[1m]
      ANTHROPIC_DEFAULT_OPUS_MODEL: deepseek-v4-pro[1m]
      CLAUDE_CODE_SUBAGENT_MODEL: deepseek-v4-pro
      CLAUDE_CODE_EFFORT_LEVEL: high
  moonshot:
    base_url: https://api.moonshot.ai/anthropic
    model: kimi-k2.6
    env:
      ENABLE_TOOL_SEARCH: "1"
```

> **Implementer note:** before committing, verify the non-secret `env` values above match the current `config/creds/deepseek.json` and `config/creds/kimi.json` env blocks (minus `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BASE_URL`, `ANTHROPIC_MODEL`). Read those files (do NOT print the token) and reconcile any extra tuning keys. Keys present in the source env but absent above must be added; the token must never appear here.

- [ ] **Step 2: Write `config/permission-presets.yaml`**

```yaml
# Presets de permissão por PAPEL (não por provider). Derivados 1-para-1 dos
# creds atuais. O deny de secrets aparece em TODOS os presets.
# Consumido pelo gerador (scripts/gen-creds) para montar creds/<profile>.json.
presets:
  no-write:
    deny:
      - Write
      - Edit
      - NotebookEdit
      - Bash
      - Read(./.env)
      - Read(./.env.*)
      - Read(**/.env)
      - Read(**/.env.*)
      - Read(**/*.pem)
      - Read(**/id_rsa)
      - Read(**/id_ed25519)
      - Read(**/.aws/**)
      - Read(**/.ssh/**)
      - Read(**/credentials)
  readonly:
    allow:
      - Bash(grep:*)
      - Bash(find:*)
      - Bash(wc:*)
      - Bash(git log:*)
      - Bash(git diff:*)
      - Bash(git show:*)
      - Bash(git blame:*)
      - Bash(ls:*)
      - Read
    deny:
      - Write
      - Edit
      - NotebookEdit
      - Read(./.env)
      - Read(./.env.*)
      - Read(**/.env)
      - Read(**/.env.*)
      - Read(**/*.pem)
      - Read(**/id_rsa)
      - Read(**/id_ed25519)
      - Read(**/.aws/**)
      - Read(**/.ssh/**)
      - Read(**/credentials)
  write-md:
    allow:
      - Write(**/*.md)
      - Edit(**/*.md)
      - Read
      - Bash(mkdir:*)
      - Bash(ls:*)
    deny:
      - Read(./.env)
      - Read(./.env.*)
      - Read(**/.env)
      - Read(**/.env.*)
      - Read(**/*.pem)
      - Read(**/id_rsa)
      - Read(**/id_ed25519)
      - Read(**/.aws/**)
      - Read(**/.ssh/**)
      - Read(**/credentials)
  full:
    deny:
      - Read(./.env)
      - Read(./.env.*)
      - Read(**/.env)
      - Read(**/.env.*)
      - Read(**/*.pem)
      - Read(**/id_rsa)
      - Read(**/id_ed25519)
      - Read(**/.aws/**)
      - Read(**/.ssh/**)
      - Read(**/credentials)
```

- [ ] **Step 3: Write the failing parse test** in `tests/providers.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";

const CONFIG = join(import.meta.dirname, "..", "config");

describe("config/providers.yaml", () => {
  it("defines deepseek with base_url and model, no token", () => {
    const raw = yaml.load(readFileSync(join(CONFIG, "providers.yaml"), "utf-8")) as any;
    expect(raw.providers.deepseek.base_url).toBe("https://api.deepseek.com/anthropic");
    expect(raw.providers.deepseek.model).toBe("deepseek-v4-pro[1m]");
    const envJson = JSON.stringify(raw.providers.deepseek.env ?? {});
    expect(envJson).not.toContain("ANTHROPIC_AUTH_TOKEN");
    expect(envJson).not.toContain("sk-");
  });
});

describe("config/permission-presets.yaml", () => {
  it("defines no-write, readonly, write-md, full with secret denies", () => {
    const raw = yaml.load(readFileSync(join(CONFIG, "permission-presets.yaml"), "utf-8")) as any;
    for (const name of ["no-write", "readonly", "write-md", "full"]) {
      expect(raw.presets[name]).toBeDefined();
      expect(raw.presets[name].deny).toContain("Read(**/.env)");
    }
    expect(raw.presets["no-write"].deny).toContain("Write");
    expect(raw.presets["readonly"].allow).toContain("Read");
    expect(raw.presets["write-md"].allow).toContain("Write(**/*.md)");
  });
});
```

- [ ] **Step 4: Run the test** — `npm test -- tests/providers.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit** — `git add config/providers.yaml config/permission-presets.yaml tests/providers.test.ts && git commit -m "feat(config): provider registry + permission presets (source of truth)"`

---

### Task 2: providers.ts — load + resolve provider env; bootstrap secrets script

**Files:**
- Create: `src/providers.ts`
- Create: `scripts/bootstrap-secrets.ts`
- Test: `tests/providers-resolve.test.ts`

**Interfaces:**
- Consumes: `config/providers.yaml`, `config/permission-presets.yaml` (Task 1 shapes), `config/creds/secrets.json`.
- Produces:
  - `interface ProviderDef { base_url: string; model: string; env?: Record<string,string> }`
  - `interface Preset { allow?: string[]; deny?: string[] }`
  - `loadProviders(path: string): Record<string, ProviderDef>`
  - `loadPresets(path: string): Record<string, Preset>`
  - `loadSecrets(path: string): Record<string, Record<string,string>>` (returns `{}` if file missing)
  - `resolveProviderEnv(providerName: string, providers: Record<string,ProviderDef>, secrets: Record<string,Record<string,string>>): Record<string,string>` — merges `{ ANTHROPIC_BASE_URL, ...provider.env, ...secrets[providerName] }`; THROWS `Error` if the provider is unknown; the token key from secrets wins.
  - `configDir(): string` — absolute path to the repo `config/` dir (resolve from `src/providers.ts` location: `join(import.meta.dirname, "..", "config")`).

**Context:** `resolveProviderEnv` is the single place that combines non-secret provider env with the secret token. It never logs. `bootstrap-secrets.ts` is a one-time migration that reads existing tokens and writes `secrets.json` — the controller runs it, never a subagent, and it never prints token values.

- [ ] **Step 1: Write the failing test** in `tests/providers-resolve.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { resolveProviderEnv, type ProviderDef } from "../src/providers.js";

const PROVIDERS: Record<string, ProviderDef> = {
  deepseek: {
    base_url: "https://api.deepseek.com/anthropic",
    model: "deepseek-v4-pro[1m]",
    env: { ANTHROPIC_DEFAULT_HAIKU_MODEL: "deepseek-v4-pro" },
  },
};
const SECRETS = { deepseek: { ANTHROPIC_AUTH_TOKEN: "sk-TEST" } };

describe("resolveProviderEnv", () => {
  it("merges base_url, provider env, and the secret token", () => {
    const env = resolveProviderEnv("deepseek", PROVIDERS, SECRETS);
    expect(env.ANTHROPIC_BASE_URL).toBe("https://api.deepseek.com/anthropic");
    expect(env.ANTHROPIC_DEFAULT_HAIKU_MODEL).toBe("deepseek-v4-pro");
    expect(env.ANTHROPIC_AUTH_TOKEN).toBe("sk-TEST");
  });

  it("does NOT set ANTHROPIC_MODEL (model comes from the --model flag)", () => {
    const env = resolveProviderEnv("deepseek", PROVIDERS, SECRETS);
    expect(env.ANTHROPIC_MODEL).toBeUndefined();
  });

  it("throws on unknown provider", () => {
    expect(() => resolveProviderEnv("nope", PROVIDERS, SECRETS)).toThrow(/unknown provider/i);
  });

  it("tolerates a missing secret (env without token) — spawn will fail loudly at claude, not here", () => {
    const env = resolveProviderEnv("deepseek", PROVIDERS, {});
    expect(env.ANTHROPIC_BASE_URL).toBe("https://api.deepseek.com/anthropic");
    expect(env.ANTHROPIC_AUTH_TOKEN).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails** — `npm test -- tests/providers-resolve.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Write `src/providers.ts`**

```typescript
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

/** Absolute path to the repo's config/ dir, relative to this compiled module. */
export function configDir(): string {
  return join(import.meta.dirname, "..", "config");
}

export function loadProviders(path: string): Record<string, ProviderDef> {
  const raw = yaml.load(readFileSync(path, "utf-8")) as { providers?: Record<string, ProviderDef> } | null;
  return raw?.providers ?? {};
}

export function loadPresets(path: string): Record<string, Preset> {
  const raw = yaml.load(readFileSync(path, "utf-8")) as { presets?: Record<string, Preset> } | null;
  return raw?.presets ?? {};
}

/** Secret store: provider -> { ANTHROPIC_AUTH_TOKEN, ... }. Missing file => {}. */
export function loadSecrets(path: string): Record<string, Record<string, string>> {
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, "utf-8")) as Record<string, Record<string, string>>;
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
```

- [ ] **Step 4: Run the test to verify it passes** — `npm test -- tests/providers-resolve.test.ts` — Expected: PASS.

- [ ] **Step 5: Write `scripts/bootstrap-secrets.ts`** (one-time token migration; run by controller)

```typescript
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
  const env = (JSON.parse(readFileSync(p, "utf-8")).env ?? {}) as Record<string, string>;
  return env.ANTHROPIC_AUTH_TOKEN;
}

const secrets: Record<string, Record<string, string>> = {};
for (const [provider, file] of Object.entries(SOURCES)) {
  const token = tokenFrom(file);
  if (token) {
    secrets[provider] = { ANTHROPIC_AUTH_TOKEN: token };
    console.log(`bootstrapped token for provider "${provider}" (value redacted)`);
  } else {
    console.log(`no token found for provider "${provider}" (source ${file} missing/empty) — skipped`);
  }
}

const out = join(CREDS, "secrets.json");
writeFileSync(out, JSON.stringify(secrets, null, 2) + "\n", "utf-8");
chmodSync(out, 0o600);
console.log(`wrote ${out} with providers: ${Object.keys(secrets).join(", ") || "none"} (chmod 600)`);
```

- [ ] **Step 6: Commit** — `git add src/providers.ts scripts/bootstrap-secrets.ts tests/providers-resolve.test.ts && git commit -m "feat(providers): loader + resolveProviderEnv + secrets bootstrap script"`

---

### Task 3: types.ts + config.ts — provider/permissions fields, derived settings, drop allowed_tools

**Files:**
- Modify: `src/types.ts`
- Modify: `src/config.ts`
- Test: `tests/config.test.ts` (add cases)
- Modify: `tests/fixtures/global-profiles.yaml`, `tests/fixtures/project-profiles.yaml` (add provider/permissions to at least one claude-p profile; remove any `allowed_tools`/`settings` reliance where testing the new path)

**Interfaces:**
- Consumes: profile name (now passed into `parseProfile`).
- Produces:
  - `ClaudePProfile` gains `provider?: string` and `permissions?: string` (preset name); `settings` becomes `settings: string` still (derived when absent); `allowed_tools` REMOVED from the interface.
  - `parseProfile(raw, name)` derives `settings = raw.settings ?? \`creds/${name}.json\`` and reads `provider`/`permissions`.
  - `resolveProfilePaths` unchanged except it no longer references `allowed_tools`.

**Context:** `parseProfile` currently takes only `rawProfile`. `loadConfig` iterates `Object.entries(raw.profiles)` so the name is available — thread it in. Deriving `settings` by convention (`creds/<name>.json`) lets `profiles.yaml` drop the explicit `settings:` line. Keep `resolvePath`/`configBaseDir` machinery so the derived relative path still resolves against the config dir via symlink.

- [ ] **Step 1: Write failing test** in `tests/config.test.ts` (append)

```typescript
describe("parseProfile — provider/permissions/derived settings", () => {
  it("derives settings path from profile name when omitted", () => {
    const config = loadConfig(join(FIXTURES, "global-profiles.yaml"));
    // 'deepseek' fixture profile has no explicit settings; must derive creds/deepseek.json
    const p = config.profiles["deepseek"];
    const settings = p.invocation === "claude-p" ? p.settings : "";
    expect(settings.endsWith("creds/deepseek.json")).toBe(true);
  });

  it("reads provider and permissions preset", () => {
    const config = loadConfig(join(FIXTURES, "global-profiles.yaml"));
    const p = config.profiles["deepseek"];
    if (p.invocation !== "claude-p") throw new Error("expected claude-p");
    expect(p.provider).toBe("deepseek");
    expect(p.permissions).toBe("no-write");
  });
});
```

- [ ] **Step 2: Update the fixture** `tests/fixtures/global-profiles.yaml` — for the `deepseek` profile, REMOVE any `settings:` and `allowed_tools:` lines, ADD `provider: deepseek` and `permissions: no-write`. Keep `model`, `color`, `tags`, `skills` as the existing config.test.ts assertions require (`model: deepseek-v4-pro`, `color: #2563EB`, `tags: [coding, editing, general]`, `skills: [design-patterns-typescript, clean-code-csharp]`).

> **Implementer note:** run `npm test -- tests/config.test.ts` after editing the fixture to confirm the pre-existing assertions (model/color/tags/skills) still pass. The derived-settings test expects NO explicit `settings:` on the `deepseek` fixture profile.

- [ ] **Step 3: Run the test to verify it fails** — `npm test -- tests/config.test.ts` — Expected: FAIL (provider undefined / settings not derived).

- [ ] **Step 4: Edit `src/types.ts`** — update `ClaudePProfile`:

```typescript
export interface ClaudePProfile {
  invocation: "claude-p";
  settings: string;          // explicit or derived (creds/<name>.json)
  model: string;
  provider?: string;         // default provider (registry key); default "deepseek" at spawn
  permissions?: string;      // permission-preset name (no-write | readonly | write-md | full)
  system_prompt?: string;
  bare?: boolean;
  timeout?: number;
  mcp_config?: string[];     // stays in YAML — cannot live in settings.json
  description: string;
  color?: string;
  tags?: string[];
  skills?: string[];
}
```
(Remove the `allowed_tools?: string[]` line.)

- [ ] **Step 5: Edit `src/config.ts`** — thread name into `parseProfile`, derive settings, read provider/permissions, drop allowed_tools:

In `loadConfig`, change the loop:
```typescript
  for (const [name, rawProfile] of Object.entries(raw.profiles ?? {})) {
    profiles[name] = parseProfile(rawProfile, name);
  }
```

Change `parseProfile` signature and the claude-p branch:
```typescript
function parseProfile(raw: Record<string, unknown>, name: string): Profile {
  const invocation = (raw.invocation as string) ?? "claude-p";

  if (invocation === "cli") {
    return {
      invocation: "cli",
      command: raw.command as string,
      model: raw.model as string,
      system_prompt: (raw.system_prompt as string) || undefined,
      stdin: (raw.stdin as boolean) ?? false,
      timeout: raw.timeout as number | undefined,
      args: (raw.args as string[]) ?? [],
      description: raw.description as string,
      color: (raw.color as string) || undefined,
      tags: (raw.tags as string[]) ?? [],
      skills: (raw.skills as string[]) ?? [],
    };
  }

  return {
    invocation: "claude-p",
    settings: (raw.settings as string) ?? `creds/${name}.json`,
    model: raw.model as string,
    provider: (raw.provider as string) || undefined,
    permissions: (raw.permissions as string) || undefined,
    system_prompt: (raw.system_prompt as string) || undefined,
    bare: (raw.bare as boolean) ?? false,
    timeout: raw.timeout as number | undefined,
    mcp_config: (raw.mcp_config as string[]) ?? [],
    description: raw.description as string,
    color: (raw.color as string) || undefined,
    tags: (raw.tags as string[]) ?? [],
    skills: (raw.skills as string[]) ?? [],
  };
}
```

Update `profileToRaw` (used by add/removeProjectProfile round-trip): replace the `allowed_tools` block with provider/permissions:
```typescript
  if (profile.invocation === "claude-p") {
    raw.settings = profile.settings;
    if (profile.provider) raw.provider = profile.provider;
    if (profile.permissions) raw.permissions = profile.permissions;
    if (profile.bare) raw.bare = profile.bare;
    if (profile.mcp_config?.length) raw.mcp_config = profile.mcp_config;
  } else {
```

- [ ] **Step 6: Run the test to verify it passes** — `npm test -- tests/config.test.ts` — Expected: PASS (new cases + all pre-existing).

- [ ] **Step 7: Commit** — `git add src/types.ts src/config.ts tests/config.test.ts tests/fixtures/global-profiles.yaml && git commit -m "feat(config): provider/permissions fields + derived settings path; drop allowed_tools"`

---

### Task 4: gen-creds — generate permission-only creds from YAML

**Files:**
- Create: `scripts/gen-creds.ts`
- Test: `tests/gen-creds.test.ts`

**Interfaces:**
- Consumes: `loadConfig` (Task 3), `loadPresets` (Task 2), `config/permission-presets.yaml`.
- Produces: exported `generateCreds(opts: { profilesPath: string; presetsPath: string; outDir: string }): string[]` returning the list of written file paths. Each written `creds/<profile>.json` = `{ "$schema": SCHEMA, "permissions": <preset block> }`. Only `claude-p` profiles with a `permissions` preset are emitted. `cli` profiles are skipped. chmod 600 each. NEVER reads secrets, NEVER prints tokens.

**Context:** The generator is pure config→files; it never touches the token (permission-only output). A profile whose `permissions` preset is unknown is a hard error (fail loudly — misconfiguration).

- [ ] **Step 1: Write failing test** in `tests/gen-creds.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { generateCreds } from "../scripts/gen-creds.js";

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "genc-"));
  mkdirSync(join(dir, "creds"), { recursive: true });
  writeFileSync(join(dir, "profiles.yaml"), [
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
  ].join("\n"));
  writeFileSync(join(dir, "presets.yaml"), [
    "presets:",
    "  no-write:",
    "    deny: [Write, Edit, 'Read(**/.env)']",
    "",
  ].join("\n"));
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
```

- [ ] **Step 2: Run the test to verify it fails** — `npm test -- tests/gen-creds.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Write `scripts/gen-creds.ts`**

```typescript
/**
 * Generator: build per-profile permission-only creds from profiles.yaml +
 * permission-presets.yaml. Output creds contain ONLY `permissions` — no secret.
 * The token is injected at spawn time from config/creds/secrets.json (see spawner).
 *
 * Usage: npx tsx scripts/gen-creds.ts
 */
import { writeFileSync, chmodSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../src/config.js";
import { loadPresets } from "../src/providers.js";
import { configDir } from "../src/providers.js";

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
    if (!presetName) continue; // no preset -> no generated cred (e.g. legacy)
    const preset = presets[presetName];
    if (!preset) {
      throw new Error(`profile "${name}" references unknown permission preset "${presetName}"`);
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
```

> **Implementer note:** confirm `import.meta.dirname` is available (Node ≥ 20.11). The repo already uses it in `tests/config.test.ts` and the plan's `src/providers.ts`. If `configDir()` resolves to `dist/../config` at runtime after build, that still points at the repo `config/` because `dist/` and `config/` are siblings — verify with the direct-run in Task 7.

- [ ] **Step 4: Run the test to verify it passes** — `npm test -- tests/gen-creds.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit** — `git add scripts/gen-creds.ts tests/gen-creds.test.ts && git commit -m "feat(gen-creds): generate permission-only creds from profiles + presets"`

---

### Task 5: spawner.ts — inject provider env at spawn; resolve model; provider override

**Files:**
- Modify: `src/spawner.ts`
- Test: `tests/spawner.test.ts` (add or create)

**Interfaces:**
- Consumes: `resolveProviderEnv`, `loadProviders`, `loadSecrets`, `configDir` (Task 2).
- Produces:
  - New exported helper `resolveSpawnEnv(profile: ClaudePProfile, providerOverride: string | undefined, providers, secrets): { env: Record<string,string>; model: string }` — resolves provider = `providerOverride ?? profile.provider ?? "deepseek"`; returns `env = { ...resolveProviderEnv(provider, ...) }` and `model = providerOverride ? providers[provider].model : profile.model`.
  - `spawnAgent(..., cwd?, providerOverride?)` — NEW trailing optional param `providerOverride?: string`. For `claude-p`, it builds the child env overlay and passes it to `cpSpawn`; `--model` uses the resolved model. `cli` profiles ignore providerOverride.

**Context:** `resolveProviderEnv` throws on unknown provider — `resolveSpawnEnv` lets it propagate (validated upstream in index.ts, but defensive here too). The child env is `{ ...process.env, ...overlay }` so the injected token/base_url take precedence (process env wins per Claude Code docs). Keep `buildClaudePArgs` passing `--settings profile.settings` and `--model <resolved>`.

- [ ] **Step 1: Write failing test** in `tests/spawner.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { resolveSpawnEnv } from "../src/spawner.js";
import type { ProviderDef } from "../src/providers.js";
import type { ClaudePProfile } from "../src/types.js";

const PROVIDERS: Record<string, ProviderDef> = {
  deepseek: { base_url: "https://api.deepseek.com/anthropic", model: "deepseek-v4-pro[1m]" },
  moonshot: { base_url: "https://api.moonshot.ai/anthropic", model: "kimi-k2.6" },
};
const SECRETS = {
  deepseek: { ANTHROPIC_AUTH_TOKEN: "sk-DS" },
  moonshot: { ANTHROPIC_AUTH_TOKEN: "sk-MOON" },
};
const profile: ClaudePProfile = {
  invocation: "claude-p",
  settings: "creds/explorer.json",
  model: "deepseek-v4-pro[1m]",
  provider: "deepseek",
  description: "t",
};

describe("resolveSpawnEnv", () => {
  it("uses the profile's provider and model by default", () => {
    const { env, model } = resolveSpawnEnv(profile, undefined, PROVIDERS, SECRETS);
    expect(env.ANTHROPIC_BASE_URL).toBe("https://api.deepseek.com/anthropic");
    expect(env.ANTHROPIC_AUTH_TOKEN).toBe("sk-DS");
    expect(model).toBe("deepseek-v4-pro[1m]");
  });

  it("override switches provider env AND model to the provider default", () => {
    const { env, model } = resolveSpawnEnv(profile, "moonshot", PROVIDERS, SECRETS);
    expect(env.ANTHROPIC_BASE_URL).toBe("https://api.moonshot.ai/anthropic");
    expect(env.ANTHROPIC_AUTH_TOKEN).toBe("sk-MOON");
    expect(model).toBe("kimi-k2.6");
  });

  it("falls back to deepseek when profile has no provider", () => {
    const { env } = resolveSpawnEnv({ ...profile, provider: undefined }, undefined, PROVIDERS, SECRETS);
    expect(env.ANTHROPIC_BASE_URL).toBe("https://api.deepseek.com/anthropic");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails** — `npm test -- tests/spawner.test.ts` — Expected: FAIL.

- [ ] **Step 3: Edit `src/spawner.ts`** — add imports and the helper, thread env into spawn:

Add near the top imports:
```typescript
import { resolveProviderEnv, loadProviders, loadSecrets, configDir, type ProviderDef } from "./providers.js";
import { join } from "node:path";
```

Add the helper (exported):
```typescript
const DEFAULT_PROVIDER = "deepseek";

/** Resolve which provider env + model a claude-p spawn should use. */
export function resolveSpawnEnv(
  profile: ClaudePProfile,
  providerOverride: string | undefined,
  providers: Record<string, ProviderDef>,
  secrets: Record<string, Record<string, string>>,
): { env: Record<string, string>; model: string } {
  const providerName = providerOverride ?? profile.provider ?? DEFAULT_PROVIDER;
  const env = resolveProviderEnv(providerName, providers, secrets);
  // When the caller overrides the provider, the profile's model is provider-
  // specific and no longer valid — use the target provider's default model.
  const model = providerOverride ? providers[providerName].model : profile.model;
  return { env, model };
}
```

Change `buildClaudePArgs` to accept a resolved model (so override works):
```typescript
export function buildClaudePArgs(
  profile: ClaudePProfile,
  prompt: string,
  model: string,
  extraArgs?: string[],
): string[] {
  const args = [
    "-p", prompt,
    "--settings", profile.settings,
    "--model", model,
  ];
  // ...unchanged rest (system_prompt, bare, mcp_config, allowed removed already, skills, extraArgs)
```
(Remove the `--allowedTools` loop entirely — `allowed_tools` no longer exists on the profile.)

In `spawnAgent`, add the trailing param and build the child env:
```typescript
export async function spawnAgent(
  profile: Profile,
  profileName: string,
  prompt: string,
  outputPath: string,
  extraArgs?: string[],
  cwd?: string,
  providerOverride?: string,
): Promise<SpawnResult> {
  const timeout = (profile.timeout ?? DEFAULT_TIMEOUT) * 1000;
  const start = Date.now();

  let command: string;
  let args: string[];
  let stdinData: string | undefined;
  let childEnv: NodeJS.ProcessEnv = process.env;
  let resolvedModel = profile.model;

  if (profile.invocation === "claude-p") {
    const dir = configDir();
    const providers = loadProviders(join(dir, "providers.yaml"));
    const secrets = loadSecrets(join(dir, "creds", "secrets.json"));
    const resolved = resolveSpawnEnv(profile, providerOverride, providers, secrets);
    resolvedModel = resolved.model;
    childEnv = { ...process.env, ...resolved.env };
    command = "claude";
    args = buildClaudePArgs(profile, prompt, resolvedModel, extraArgs);
  } else {
    const cliArgs = buildCliArgs(profile, prompt);
    command = cliArgs.command;
    args = cliArgs.args;
    stdinData = cliArgs.stdin;
  }
```
Then in the `cpSpawn` call, pass `env: childEnv`:
```typescript
    const child = cpSpawn(command, args, {
      signal: ac.signal,
      cwd: cwd ?? process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
      env: childEnv,
    });
```
And in both `resolve(...)` results, report `model: resolvedModel` instead of `profile.model` (so the reported model reflects an override).

> **Implementer note:** `buildClaudePArgs` now takes `model` as a required 3rd arg — update its one call site (inside `spawnAgent`, shown above). Grep for other callers: `grep -rn "buildClaudePArgs" src tests` and fix any. The `resolveProviderEnv` call can throw on an unknown override; that propagates out of `spawnAgent` as a rejected promise — acceptable, since index.ts validates first.

- [ ] **Step 4: Run the test to verify it passes** — `npm test -- tests/spawner.test.ts` — Expected: PASS.

- [ ] **Step 5: Run the full suite** — `npm test` — Expected: all PASS (spawner signature change ripples to runtime.ts/index.ts callers — if the suite fails on arity, note it for Task 6; `spawnAgent`'s new param is optional so existing calls still compile).

- [ ] **Step 6: Commit** — `git add src/spawner.ts tests/spawner.test.ts && git commit -m "feat(spawner): inject provider env at spawn + provider override + model resolution"`

---

### Task 6: index.ts — spawn_agent provider input + validation

**Files:**
- Modify: `src/index.ts`
- Test: covered by manual canary in Task 7 (MCP tool wiring); no new unit test required — but add an input-validation guard mirroring `archon_run`.

**Interfaces:**
- Consumes: `loadProviders`, `configDir` (Task 2), `spawnAgent(..., providerOverride)` (Task 5).
- Produces: `spawn_agent` MCP tool gains an optional `provider` input; validated against the provider registry before spawning; passed to `spawnAgent`.

**Context:** `provider` is LLM-supplied → trust boundary. Validate against `loadProviders(...)` keys and return `isError` on unknown, exactly like `archon_run` validates generator names.

- [ ] **Step 1: Edit `src/index.ts`** — add the import:
```typescript
import { loadProviders, configDir } from "./providers.js";
import { join } from "node:path";
```

Add `provider` to the `spawn_agent` inputSchema:
```typescript
      provider: z
        .string()
        .optional()
        .describe(
          "Provider registry key to run this profile against (e.g. 'deepseek', 'moonshot'). Omit to use the profile's default provider.",
        ),
```

In the handler, destructure `provider` and validate before spawning:
```typescript
  async ({ profile: profileName, prompt, extra_args, provider }) => {
    const config = getConfig();
    const profile = config.profiles[profileName];

    if (!profile) {
      // ...unchanged not-found branch
    }

    // provider is LLM-supplied — validate against the registry (trust boundary).
    if (provider) {
      const providers = loadProviders(join(configDir(), "providers.yaml"));
      if (!providers[provider]) {
        const known = Object.keys(providers).join(", ");
        return {
          content: [{ type: "text" as const, text: `Unknown provider "${provider}". Known: ${known || "none"}` }],
          isError: true,
        };
      }
    }
```

Pass `provider` through the spawn call:
```typescript
    const result = await spawnAgent(
      profile,
      profileName,
      enrichedPrompt,
      outputPath,
      enrichedArgs,
      process.cwd(),
      provider,
    );
```
(Note: the 6th arg `cwd` was previously omitted; pass `process.cwd()` explicitly so the 7th `provider` lines up.)

- [ ] **Step 2: Build to typecheck** — `npm run build` (or `npx tsc --noEmit`) — Expected: no type errors.

- [ ] **Step 3: Run the full suite** — `npm test` — Expected: all PASS.

- [ ] **Step 4: Commit** — `git add src/index.ts && git commit -m "feat(mcp): spawn_agent provider selection with registry validation"`

---

### Task 7: Migrate profiles.yaml + README; generate; canary-verify

**Files:**
- Modify: `config/profiles.yaml` (all claude-p profiles + header docs)
- Modify: `config/creds/README.md`
- Modify: `.gitignore` (ensure `config/creds/secrets.json` is covered — it already matches `config/creds/*.json`, but the generated permission files also match; add an explicit note)

**Interfaces:**
- Consumes: everything above.
- Produces: the real, migrated `profiles.yaml`; generated `config/creds/*.json` (permission-only); `secrets.json` (via bootstrap, controller-run).

**Context:** This task makes the real config match the new model. Per-profile mapping (provider is `deepseek` for ALL; preset per the table):

| profile | permissions preset |
|---|---|
| deepseek, deepseek-1m | no-write |
| explorer, reviewer, researcher, security-reviewer, refactorer | readonly |
| coder, analyst, ts-reviewer, python-reviewer, csharp-reviewer, go-reviewer | no-write |
| memory-writer | write-md |
| codex | (cli — no change) |

- [ ] **Step 1: Edit `config/profiles.yaml`** — for EVERY `claude-p` profile:
  - REMOVE the `settings:` line (now derived as `creds/<name>.json`).
  - REMOVE the `allowed_tools:` line.
  - ADD `provider: deepseek`.
  - ADD `permissions: <preset from the table above>`.
  - KEEP `mcp_config:` where present (explorer keeps `- semble.mcp.json`; others keep `[]` or drop the empty line — either is fine, prefer removing empty `mcp_config: []` for cleanliness).
  - KEEP `model`, `system_prompt`, `bare`, `skills`, `color`, `tags`, `timeout`, `description`.
  Leave the `codex` (cli) profile untouched.

- [ ] **Step 2: Update the `profiles.yaml` header comment block** — replace the `settings`/`allowed_tools` field docs and the "Guards de segurança" section to describe: `provider` (registry key), `permissions` (preset name), that creds are GENERATED (permission-only) by `scripts/gen-creds.ts`, and that the token lives only in `config/creds/secrets.json`. Remove references to per-file `settings: creds/deepseek.json` and `allowed_tools`.

- [ ] **Step 3: Update `config/creds/README.md`** — rewrite the table and format section to document the new model: `secrets.json` (unified token store, the ONLY secret), generated `<profile>.json` (permission-only, from `gen-creds`), and how to regenerate (`npx tsx scripts/gen-creds.ts`). Keep the chmod 600 instruction.

- [ ] **Step 4: Controller bootstrap (NOT a subagent step)** — the controller runs, capturing no token in context:
```bash
npx tsx scripts/bootstrap-secrets.ts
chmod 600 config/creds/secrets.json
```
Expected stdout: `bootstrapped token for provider "deepseek" (value redacted)` etc. — no token value printed.

- [ ] **Step 5: Generate the creds** —
```bash
npx tsx scripts/gen-creds.ts
```
Expected: prints `generated N cred(s):` listing `config/creds/<profile>.json` for every claude-p profile. Verify one file is permission-only:
```bash
python3 -c "import json; d=json.load(open('config/creds/explorer.json')); print('has_env', 'env' in d); print('preset_ok', 'Read' in d['permissions']['allow'])"
```
Expected: `has_env False`, `preset_ok True`.

- [ ] **Step 6: Canary spawn per preset** — verify each preset actually routes to DeepSeek and honors permissions. Run the MCP server's spawn path directly (or via a tiny script) for one profile per preset. Minimal check via the built server or a script calling `spawnAgent`:
```bash
# readonly canary (explorer): must answer using the injected DeepSeek token.
npx tsx -e "
import { spawnAgent } from './src/spawner.js';
import { loadMergedConfig } from './src/config.js';
const cfg = loadMergedConfig(process.cwd());
const p = cfg.profiles['explorer'];
const out = '/tmp/pa-canary-explorer.txt';
const r = await spawnAgent(p, 'explorer', 'Responda apenas: CANARY_OK', out, [], process.cwd());
console.log('status', r.status, 'model', r.model);
"
```
Expected: `status ok` and the output file contains a real model response (not an auth error). Repeat for `deepseek` (no-write) and `memory-writer` (write-md) if time permits. If auth fails, the env injection is wrong — STOP and fix Task 5.

- [ ] **Step 7: Run the full suite** — `npm test` — Expected: all PASS.

- [ ] **Step 8: Commit** — `git add config/profiles.yaml config/creds/README.md .gitignore && git commit -m "feat(config): migrate profiles to provider/permissions model; regenerate creds"`
  (Note: `config/creds/*.json` — including `secrets.json` and the generated files — are gitignored and MUST NOT be staged. Verify with `git status --short config/creds/` before committing: only `README.md` should appear.)

---

## Final Verification (controller, after all tasks)

- [ ] `npm test` — full suite green; capture output.
- [ ] `npm run build` — clean typecheck/bundle.
- [ ] `git status --short config/creds/` — confirms no `*.json` staged (only README tracked).
- [ ] Confirm the old creds (`deepseek.json`, `deepseek-readonly.json`, `deepseek-memory.json`, `deepseek-all.json`, `kimi.json`) are now redundant with the generated ones + `secrets.json`. Do NOT delete them in this branch (two-step deletion) — list them as a follow-up.
- [ ] Dispatch the final whole-branch review (most capable model).

## Follow-ups (documented, out of scope)

1. **`coder` preset decision** — currently `no-write` while its prompt demands Write/Bash/Edit. Decide: `write` preset vs prompt rewrite.
2. **Delete legacy creds** — after a green run, remove `deepseek.json`/`deepseek-readonly.json`/`deepseek-memory.json`/`deepseek-all.json`/`kimi.json` (superseded by `secrets.json` + generated files). Separate commit.
3. **Real gateway** — if a single physical key must front multiple providers, add an OpenRouter/LiteLLM entry to `providers.yaml`.
