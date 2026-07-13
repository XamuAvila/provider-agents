import { describe, expect, it } from "vitest";
import { suggestExecution } from "./routing.js";
import type { Config } from "./types.js";
import type { ProviderDef } from "./providers.js";

const profile = (model: string, provider = "deepseek") => ({
  invocation: "claude-p" as const,
  settings: "/tmp/settings.json",
  model,
  provider,
  description: "test",
});
const config: Config = {
  defaults: { output_dir: "/tmp" },
  profiles: {
    deepseek: profile("deepseek-v4-pro"), coder: profile("deepseek-v4-pro"),
    reviewer: profile("deepseek-v4-pro"), analyst: profile("deepseek-v4-pro"),
    explorer: profile("deepseek-v4-pro"), researcher: profile("deepseek-v4-pro"),
    refactorer: profile("deepseek-v4-pro"), "security-reviewer": profile("deepseek-v4-pro"),
    websearcher: profile("deepseek-v4-flash"), kimi: profile("kimi-k2.6", "moonshot"),
    "agent-drawer": profile("deepseek-v4-flash"),
    explainer: profile("deepseek-v4-pro"),
  },
};
const providers: Record<string, ProviderDef> = {
  deepseek: { base_url: "ds", model: "deepseek-v4-pro", models: { "deepseek-v4-pro": { capabilities: [], context_window: 1, cost_tier: "medium", thinking: "optional" } } },
  moonshot: { base_url: "ms", model: "kimi-k2.6", models: {
    "kimi-k2.6": { capabilities: [], context_window: 1, cost_tier: "high", thinking: "optional" },
    "kimi-k2.7-code": { capabilities: [], context_window: 1, cost_tier: "high", thinking: "always" },
  } },
};

describe("suggestExecution", () => {
  it("routes multimodal work to Kimi K2.6", () => {
    expect(suggestExecution("Analise este screenshot", config, providers)).toMatchObject({ profile: "kimi", provider: "moonshot", model: "kimi-k2.6" });
  });
  it("routes long agentic implementation to Kimi K2.7 Code", () => {
    expect(suggestExecution("Implemente e teste uma migração em múltiplos arquivos", config, providers)).toMatchObject({ profile: "coder", provider: "moonshot", model: "kimi-k2.7-code" });
  });
  it("keeps debugging on DeepSeek Pro", () => {
    expect(suggestExecution("Faça root cause deste stack trace", config, providers)).toMatchObject({ profile: "analyst", provider: "deepseek", model: "deepseek-v4-pro" });
  });
  it("routes Mermaid debugging diagrams to the drawer", () => {
    expect(suggestExecution("Desenhe um diagrama Mermaid deste fluxo", config, providers)).toMatchObject({
      profile: "agent-drawer", provider: "deepseek", model: "deepseek-v4-flash",
    });
  });
  it("routes codebase understanding to the explainer", () => {
    expect(suggestExecution("Explique como funciona este codebase para onboarding", config, providers)).toMatchObject({
      profile: "explainer", provider: "deepseek", model: "deepseek-v4-pro",
    });
  });
});
