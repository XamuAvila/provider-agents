import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";

const CONFIG = join(import.meta.dirname, "..", "config");

describe("config/providers.yaml", () => {
  it("defines deepseek with base_url and model, no token", () => {
    const raw = yaml.load(
      readFileSync(join(CONFIG, "providers.yaml"), "utf-8"),
    ) as { providers: Record<string, { base_url: string; model: string; env?: Record<string, string> }> };
    expect(raw.providers.deepseek.base_url).toBe("https://api.deepseek.com/anthropic");
    expect(raw.providers.deepseek.model).toBe("deepseek-v4-pro");
    const envJson = JSON.stringify(raw.providers.deepseek.env ?? {});
    expect(envJson).not.toContain("ANTHROPIC_AUTH_TOKEN");
    expect(envJson).not.toContain("sk-");
    // ANTHROPIC_MODEL is intentionally omitted (model comes from the --model flag).
    expect(envJson).not.toContain("ANTHROPIC_MODEL");
  });

  it("defines moonshot as a second provider", () => {
    const raw = yaml.load(
      readFileSync(join(CONFIG, "providers.yaml"), "utf-8"),
    ) as { providers: Record<string, { base_url: string }> };
    expect(raw.providers.moonshot.base_url).toBe("https://api.moonshot.ai/anthropic");
  });

  it("declares allowed models and routing capabilities", () => {
    const raw = yaml.load(readFileSync(join(CONFIG, "providers.yaml"), "utf-8")) as {
      providers: Record<string, { models?: Record<string, { capabilities: string[] }> }>;
    };
    expect(raw.providers.deepseek.models?.["deepseek-v4-pro"].capabilities).toContain("reasoning");
    expect(raw.providers.moonshot.models?.["kimi-k2.7-code"].capabilities).toContain("agentic");
  });
});

describe("config/permission-presets.yaml", () => {
  it("defines role presets with secret denies", () => {
    const raw = yaml.load(
      readFileSync(join(CONFIG, "permission-presets.yaml"), "utf-8"),
    ) as { presets: Record<string, { allow?: string[]; deny?: string[] }> };
    for (const name of ["no-write", "readonly", "write-md", "drawer", "full"]) {
      expect(raw.presets[name]).toBeDefined();
      expect(raw.presets[name].deny).toContain("Read(**/.env)");
    }
    expect(raw.presets["no-write"].deny).toContain("Write");
    expect(raw.presets["readonly"].allow).toContain("Read");
    expect(raw.presets["write-md"].allow).toContain("Write(**/*.md)");
    expect(raw.presets.drawer.allow).toContain("Write(/tmp/**)");
    expect(raw.presets.drawer.allow).toContain("Bash(xdg-open:*)");
  });

  it("defines a write preset that allows Write/Bash but denies secrets", () => {
    const raw = yaml.load(
      readFileSync(join(CONFIG, "permission-presets.yaml"), "utf-8"),
    ) as { presets: Record<string, { allow?: string[]; deny?: string[] }> };
    expect(raw.presets["write"].allow).toContain("Write");
    expect(raw.presets["write"].allow).toContain("Bash");
    expect(raw.presets["write"].deny).toContain("Read(**/.env)");
  });
});
