/**
 * Automatic prompt enrichment for provider-agents spawns.
 *
 * Handles two concerns the caller shouldn't have to remember:
 *  1. Auto-inject `--add-dir <cwd>` so claude-p agents can read the repo.
 *  2. Wrap DeepSeek prompts in XML tags and strip known anti-patterns
 *     (DeepThink performs worse with "think step by step" / few-shot).
 */

function isDeepSeek(model: string): boolean {
  return model.toLowerCase().startsWith("deepseek");
}

const STEP_BY_STEP_PATTERNS = [
  /pense\s+passo\s+a\s+passo/gi,
  /think\s+step\s+by\s+step/gi,
  /reason\s+step\s+by\s+step/gi,
];

/**
 * Auto-inject `--add-dir <cwd>` for claude-p profiles when the caller
 * didn't already pass one. Returns undefined for cli profiles (extra_args
 * are ignored there).
 */
export function autoAddDir(
  invocation: string,
  extraArgs: string[] | undefined,
  cwd: string,
): string[] | undefined {
  if (invocation !== "claude-p") return undefined;

  const args = extraArgs ? [...extraArgs] : [];
  if (args.includes("--add-dir")) return args.length > 0 ? args : undefined;
  args.push("--add-dir", cwd);
  return args;
}

/**
 * Enrich a prompt for the target model. For DeepSeek (DeepThink mode):
 *  - Wrap in `<task>` XML tags (unless already tagged)
 *  - Strip known anti-patterns that degrade DeepThink performance
 *  - Append a structured-output nudge
 *
 * Non-DeepSeek models get the prompt unchanged.
 */
export function enrichPrompt(prompt: string, model: string): string {
  if (!isDeepSeek(model)) return prompt;

  let enriched = prompt;

  for (const pattern of STEP_BY_STEP_PATTERNS) {
    enriched = enriched.replace(pattern, "").trim();
  }

  if (enriched.includes("<task>")) return enriched;

  return [
    "<task>",
    enriched,
    "</task>",
    "",
    "Respond with structured, concise output. Use file:line references when citing code.",
  ].join("\n");
}
