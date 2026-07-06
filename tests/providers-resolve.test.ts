import { describe, it, expect } from "vitest";
import { resolveProviderEnv, validateProviderModel, type ProviderDef } from "../src/providers.js";

const PROVIDERS: Record<string, ProviderDef> = {
  deepseek: {
    base_url: "https://api.deepseek.com/anthropic",
    model: "deepseek-v4-pro",
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

  it("tolerates a missing secret (env without token)", () => {
    const env = resolveProviderEnv("deepseek", PROVIDERS, {});
    expect(env.ANTHROPIC_BASE_URL).toBe("https://api.deepseek.com/anthropic");
    expect(env.ANTHROPIC_AUTH_TOKEN).toBeUndefined();
  });
});

describe("validateProviderModel", () => {
  it("accepts the provider default and rejects unknown model ids", () => {
    expect(() => validateProviderModel("deepseek", "deepseek-v4-pro", PROVIDERS)).not.toThrow();
    expect(() => validateProviderModel("deepseek", "kimi-k2.7-code", PROVIDERS)).toThrow(/unknown model/i);
  });
});
