import type { Config, Profile } from "./types.js";
import type { ProviderDef } from "./providers.js";

export interface ExecutionSuggestion {
  profile: string;
  provider: string;
  model: string;
  confidence: "high" | "medium";
  reasons: string[];
  alternative?: { profile: string; provider: string; model: string };
}

type Rule = {
  profile: string;
  terms: string[];
  provider?: string;
  model?: string;
  reason: string;
};

const RULES: Rule[] = [
  { profile: "agent-drawer", terms: ["diagrama", "diagram", "flowchart", "mermaid", "visualize", "visualizar", "desenhe", "draw"], reason: "visualização de fluxo de debugging" },
  { profile: "kimi", provider: "moonshot", model: "kimi-k2.6", terms: ["imagem", "image", "vídeo", "video", "multimodal", "screenshot"], reason: "entrada multimodal" },
  { profile: "security-reviewer", terms: ["security", "segurança", "vulnerability", "vulnerabilidade", "owasp", "auth", "injection", "xss"], reason: "revisão de segurança" },
  { profile: "websearcher", terms: ["web", "internet", "latest", "atualizado", "documentação externa", "release notes"], reason: "pesquisa web" },
  { profile: "analyst", terms: ["debug", "root cause", "rca", "stack trace", "arquitetura", "architecture", "impacto"], reason: "análise e diagnóstico" },
  { profile: "explorer", terms: ["explore", "explorar", "localize", "encontre", "call site", "dependência", "dependency", "trace"], reason: "exploração de código" },
  { profile: "researcher", terms: ["compare", "comparar", "biblioteca", "library", "alternativa", "trade-off"], reason: "pesquisa comparativa" },
  { profile: "refactorer", terms: ["refactor", "refator", "dead code", "cleanup", "simplif"], reason: "refatoração" },
  { profile: "reviewer", terms: ["review", "revis", "diff", "regressão", "regression"], reason: "revisão de código" },
  { profile: "coder", terms: ["implement", "implementar", "crie", "create", "corrija", "fix", "endpoint", "feature"], reason: "implementação" },
];

const LONG_HORIZON_TERMS = [
  "agentic", "long-horizon", "múltiplos arquivos", "multiple files", "migração",
  "migration", "end-to-end", "implemente e teste", "implement and test", "complexo",
];

function includesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function providerFor(profile: Profile): string {
  return profile.invocation === "claude-p" ? profile.provider ?? "deepseek" : "cli";
}

export function suggestExecution(
  task: string,
  config: Config,
  providers: Record<string, ProviderDef>,
): ExecutionSuggestion {
  const text = task.toLowerCase();
  const matched = RULES.find((rule) => includesAny(text, rule.terms));
  const fallbackName = config.profiles.deepseek ? "deepseek" : Object.keys(config.profiles)[0];
  const profileName = matched && config.profiles[matched.profile] ? matched.profile : fallbackName;
  if (!profileName) throw new Error("no profiles available");

  const profile = config.profiles[profileName];
  let provider = matched?.provider ?? providerFor(profile);
  let model = matched?.model ?? profile.model;
  const reasons = [matched?.reason ?? "fallback generalista"];

  const codingRole = profileName === "coder" || profileName === "reviewer";
  const longHorizon = task.length > 1200 || includesAny(text, LONG_HORIZON_TERMS);
  if (codingRole && longHorizon && providers.moonshot?.models?.["kimi-k2.7-code"]) {
    provider = "moonshot";
    model = "kimi-k2.7-code";
    reasons.push("tarefa de coding longa/agentic");
  }

  const alternative =
    model === "kimi-k2.7-code" && providers.deepseek?.models?.["deepseek-v4-pro"]
      ? { profile: profileName, provider: "deepseek", model: "deepseek-v4-pro" }
      : providers.moonshot?.models?.["kimi-k2.7-code"] && codingRole
        ? { profile: profileName, provider: "moonshot", model: "kimi-k2.7-code" }
        : undefined;

  return {
    profile: profileName,
    provider,
    model,
    confidence: matched ? "high" : "medium",
    reasons,
    alternative,
  };
}
