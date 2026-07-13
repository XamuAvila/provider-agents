
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server";
import * as z from "zod";
import { join } from "node:path";
import { loadMergedConfig, globalConfigDir, profileToRaw } from "./config.js";
import {
  upsertGlobalProfileRaw,
  deleteGlobalProfile,
  readGlobalProfileRaw,
} from "./registry.js";
import { spawnAgent } from "./spawner.js";
import { loadProviders, loadPresets, validateProviderModel } from "./providers.js";
import { listSkills, getSkill, getSkillPattern } from "./skills.js";
import {
  listScripts,
  getScript,
  writeScript,
  removeScript,
  scriptExists,
  runScript,
} from "./scripts.js";
import {
  createOutputPath,
  readOutput,
  listOutputs,
  cleanupOldOutputs,
} from "./output.js";
import type { Config, Profile, ClaudePProfile, CliProfile } from "./types.js";
import { autoAddDir, enrichPrompt } from "./prompt-enrichment.js";
import { persistMemoryHook } from "./memory-hook.js";
import { retrieveMemories } from "./memory-retrieval.js";
import { runArchon, DEFAULT_POOLS, resolveVaultDir } from "./archon/index.js";
import { suggestExecution } from "./routing.js";

const server = new McpServer({
  name: "provider-agents",
  version: "0.5.0",
});

function getConfig(): Config {
  return loadMergedConfig(process.cwd());
}

server.registerTool(
  "list_profiles",
  {
    title: "List Profiles",
    description:
      "List available provider profiles (merged from global ~/.config/provider-agents/profiles.yaml and project .claude/profiles.yaml).",
    inputSchema: z.object({}),
  },
  async () => {
    const config = getConfig();
    const lines: string[] = [];

    for (const [name, profile] of Object.entries(config.profiles)) {
      const timeout = profile.timeout ?? 600;
      lines.push(
        `${name} [${profile.invocation}] model=${profile.model} timeout=${timeout}s — ${profile.description}`,
      );
    }

    if (lines.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: "No profiles found. Create ~/.config/provider-agents/profiles.yaml or .claude/profiles.yaml.",
          },
        ],
      };
    }

    return {
      content: [{ type: "text" as const, text: lines.join("\n") }],
    };
  },
);

server.registerTool(
  "add_profile",
  {
    title: "Add / Update Profile",
    description:
      "Create or update an agent profile in the GLOBAL registry (config/profiles.yaml, shared across projects). " +
      "Comment-preserving. Use invocation=claude-p for Anthropic-compatible APIs, or invocation=cli for standalone CLI tools. " +
      "Compose the agent via: model, provider, permissions preset (its 'tools'), skills (physical skills/ folders), system_prompt.",
    inputSchema: z.object({
      name: z
        .string()
        .describe("Profile name (e.g. 'deepseek', 'explorer', 'memory-writer')"),
      invocation: z
        .enum(["claude-p", "cli"])
        .describe("Invocation type: claude-p for Anthropic-compatible APIs, cli for standalone binaries"),
      model: z.string().describe("Model ID (e.g. 'deepseek-v4-pro', 'gpt-5.5')"),
      description: z.string().describe("Human-readable description"),
      settings: z
        .string()
        .optional()
        .describe("Explicit settings.json path (claude-p only). Omit when using a permissions preset — settings is derived as creds/<preset>.json."),
      provider: z
        .string()
        .optional()
        .describe("Default provider registry key (claude-p only, e.g. 'deepseek', 'moonshot'). Validated against providers.yaml."),
      permissions: z
        .string()
        .optional()
        .describe("Permission preset = the agent's tools (claude-p only: 'no-write', 'readonly', 'write-md', 'write', 'full'). Validated against permission-presets.yaml."),
      command: z
        .string()
        .optional()
        .describe("CLI binary name or path (cli only, e.g. 'pplx')"),
      system_prompt: z.string().optional().describe("System prompt text (the agent's role/instructions)"),
      bare: z.boolean().optional().describe("Disable hooks/plugins/LSP (claude-p only, default: false)"),
      stdin: z.boolean().optional().describe("Send prompt via stdin (cli only, default: false)"),
      timeout: z.number().int().min(1).optional().describe("Timeout in seconds (default: 600)"),
      mcp_config: z.array(z.string()).optional().describe("Extra MCP config paths (claude-p only)"),
      args: z.array(z.string()).optional().describe("Extra CLI flags (cli only)"),
      skills: z.array(z.string()).optional().describe("Skill folder names from skills/ (validated). Each becomes an --add-dir for the agent."),
      scripts: z.array(z.string()).optional().describe("Registered agent-script filenames from agent-scripts/ (validated) to associate with this profile."),
      tags: z.array(z.string()).optional().describe("Tags for suggest_profile matching"),
      color: z.string().optional().describe("Hex color for UI (e.g. '#2563EB')"),
    }),
  },
  async ({ name, invocation, model, description, settings, provider, permissions, command, system_prompt, bare, stdin, timeout, mcp_config, args, skills, scripts, tags, color }) => {
    if (invocation === "cli" && !command) {
      return {
        content: [{ type: "text" as const, text: "Error: 'command' is required for invocation=cli." }],
        isError: true,
      };
    }

    // Validate LLM-supplied references against their registries (trust boundary).
    const dir = globalConfigDir();
    const errors: string[] = [];
    if (provider) {
      const providers = loadProviders(join(dir, "providers.yaml"));
      if (!providers[provider]) errors.push(`Unknown provider "${provider}". Known: ${Object.keys(providers).join(", ") || "none"}`);
    }
    if (permissions) {
      const presets = loadPresets(join(dir, "permission-presets.yaml"));
      if (!presets[permissions]) errors.push(`Unknown permissions preset "${permissions}". Known: ${Object.keys(presets).join(", ") || "none"}`);
    }
    if (skills?.length) {
      const known = new Set(listSkills().map((s) => s.name));
      const unknown = skills.filter((s) => !known.has(s));
      if (unknown.length) errors.push(`Unknown skill(s): ${unknown.join(", ")}. Available: ${[...known].join(", ") || "none"}`);
    }
    if (scripts?.length) {
      const unknown = scripts.filter((s) => !scriptExists(s));
      if (unknown.length) errors.push(`Unknown script(s): ${unknown.join(", ")}. Register them first (register_script) or list with list_scripts.`);
    }
    if (errors.length) {
      return { content: [{ type: "text" as const, text: `Error:\n- ${errors.join("\n- ")}` }], isError: true };
    }

    let profile: Profile;
    if (invocation === "cli") {
      profile = {
        invocation: "cli",
        command: command!,
        model,
        description,
        system_prompt: system_prompt || undefined,
        stdin: stdin ?? false,
        timeout,
        args: args ?? [],
        skills: skills ?? [],
        scripts: scripts ?? [],
        tags: tags ?? [],
        color: color || undefined,
      } satisfies CliProfile;
    } else {
      profile = {
        invocation: "claude-p",
        // Explicit settings wins; otherwise derived at load from the preset.
        settings: settings ?? (permissions ? `creds/${permissions}.json` : `creds/${name}.json`),
        model,
        provider: provider || undefined,
        permissions: permissions || undefined,
        description,
        system_prompt: system_prompt || undefined,
        bare: bare ?? false,
        timeout,
        mcp_config: mcp_config ?? [],
        skills: skills ?? [],
        scripts: scripts ?? [],
        tags: tags ?? [],
        color: color || undefined,
      } satisfies ClaudePProfile;
    }

    const { created } = upsertGlobalProfileRaw(name, profileToRaw(profile));

    return {
      content: [{ type: "text" as const, text: `Profile "${name}" [${invocation}] ${created ? "created" : "updated"} in the global registry (config/profiles.yaml).` }],
    };
  },
);

server.registerTool(
  "remove_profile",
  {
    title: "Remove Profile",
    description: "Remove an agent profile from the GLOBAL registry (config/profiles.yaml). Comment-preserving.",
    inputSchema: z.object({
      name: z.string().describe("Profile name to remove"),
    }),
  },
  async ({ name }) => {
    const removed = deleteGlobalProfile(name);
    if (!removed) {
      return {
        content: [{ type: "text" as const, text: `Profile "${name}" not found in the global registry.` }],
        isError: true,
      };
    }

    return {
      content: [{ type: "text" as const, text: `Profile "${name}" removed from the global registry (config/profiles.yaml).` }],
    };
  },
);

server.registerTool(
  "get_profile",
  {
    title: "Get Profile",
    description:
      "Read the full definition of one agent profile from the global registry (all fields: model, provider, permissions, system_prompt, skills, tags, etc.). The 'Read' of the profile CRUD.",
    inputSchema: z.object({
      name: z.string().describe("Profile name to read"),
    }),
  },
  async ({ name }) => {
    const raw = readGlobalProfileRaw(name);
    if (!raw) {
      const available = Object.keys(getConfig().profiles).join(", ");
      return {
        content: [{ type: "text" as const, text: `Profile "${name}" not found in the global registry. Available: ${available || "none"}` }],
        isError: true,
      };
    }
    // Pretty YAML view of the single profile (source-of-truth shape).
    const lines = [`# Profile: ${name}`];
    for (const [k, v] of Object.entries(raw)) {
      const val = typeof v === "string" && v.includes("\n") ? `|\n    ${v.replace(/\n/g, "\n    ")}` : JSON.stringify(v);
      lines.push(`${k}: ${val}`);
    }
    return { content: [{ type: "text" as const, text: lines.join("\n") }] };
  },
);

server.registerTool(
  "spawn_agent",
  {
    title: "Spawn Agent",
    description:
      "Spawn an isolated agent session using a configured provider profile. The agent runs as a separate process (claude -p or standalone CLI) and its output is captured to a file. Returns the full output and metadata.",
    inputSchema: z.object({
      profile: z
        .string()
        .describe(
          "Profile name from profiles.yaml (e.g. 'deepseek', 'explorer', 'memory-writer')",
        ),
      prompt: z
        .string()
        .describe("The prompt/task to send to the agent"),
      extra_args: z
        .array(z.string())
        .optional()
        .describe(
          "Extra CLI flags passed to claude -p (e.g. ['--add-dir', './src']). Ignored for cli invocation.",
        ),
      provider: z
        .string()
        .optional()
        .describe(
          "Provider registry key to run this profile against (e.g. 'deepseek', 'moonshot'). Omit to use the profile's default provider.",
        ),
      model: z
        .string()
        .optional()
        .describe("Explicit model ID from the selected provider's models registry. Omit to use the profile/provider default."),
    }),
  },
  async ({ profile: profileName, prompt, extra_args, provider, model }) => {
    const config = getConfig();
    const profile = config.profiles[profileName];

    if (!profile) {
      const available = Object.keys(config.profiles).join(", ");
      return {
        content: [
          {
            type: "text" as const,
            text: `Profile "${profileName}" not found. Available: ${available || "none"}`,
          },
        ],
        isError: true,
      };
    }

    // provider is LLM-supplied — validate against the registry (trust boundary).
    const providers = loadProviders(join(globalConfigDir(), "providers.yaml"));
    if (profile.invocation === "cli" && (provider || model)) {
      return { content: [{ type: "text" as const, text: "provider/model overrides are only supported for claude-p profiles." }], isError: true };
    }
    if (provider) {
      if (!providers[provider]) {
        const known = Object.keys(providers).join(", ");
        return {
          content: [
            {
              type: "text" as const,
              text: `Unknown provider "${provider}". Known: ${known || "none"}`,
            },
          ],
          isError: true,
        };
      }
    }
    const targetProvider = profile.invocation === "claude-p" ? provider ?? profile.provider ?? "deepseek" : "cli";
    const targetModel = profile.invocation === "claude-p"
      ? model ?? (provider ? providers[targetProvider].model : profile.model)
      : profile.model;
    if (profile.invocation === "claude-p") {
      try {
        validateProviderModel(targetProvider, targetModel, providers);
      } catch (e) {
        return { content: [{ type: "text" as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    }

    cleanupOldOutputs(config.defaults.output_dir, 7);
    const outputPath = createOutputPath(
      config.defaults.output_dir,
      profileName,
    );

    const enrichedPrompt = enrichPrompt(prompt, targetModel);
    const enrichedArgs = autoAddDir(profile.invocation, extra_args, process.cwd());

    // Run the target agent and the memory recall CONCURRENTLY: the flash
    // retriever reads the central memories dir relevant to `prompt` while the
    // target runs, so recall adds ~0 wall-clock. Recall surfaces to THIS response
    // (the main conversation) — it is NOT injected into the target agent.
    const [result, recall] = await Promise.all([
      spawnAgent(
        profile,
        profileName,
        enrichedPrompt,
        outputPath,
        enrichedArgs,
        process.cwd(),
        provider,
        model,
      ),
      retrieveMemories(config, profileName, prompt, process.cwd()),
    ]);

    const output = readOutput(result.outputPath);

    // Fire-and-forget: after a successful non-memory delegation, the flash
    // scribe persists a durable note. Passes the ORIGINAL prompt (not the
    // enriched one) as the task and points the scribe at result.outputPath.
    const memoryQueued = persistMemoryHook(
      config,
      profileName,
      prompt,
      result,
      process.cwd(),
    );

    const recallState = recall ? (recall.found ? "hit" : "miss") : "skipped";
    const header = [
      `[provider-agents] status=${result.status} exit=${result.exitCode} duration=${Math.round(result.durationMs / 1000)}s`,
      `[provider-agents] profile=${result.profile} model=${result.model}`,
      `[provider-agents] output=${result.outputPath}`,
      `[provider-agents] auto-memory=${memoryQueued ? "queued" : "skipped"} auto-recall=${recallState}`,
      "---",
    ].join("\n");

    // Surface recalled memories to the main conversation, above the agent
    // output, only when the retriever found something relevant.
    const recallBlock =
      recall?.found
        ? `[provider-agents] recalled memories (relevant to this task):\n${recall.text}\n---\n`
        : "";

    return {
      content: [
        { type: "text" as const, text: `${header}\n${recallBlock}${output}` },
      ],
      isError: result.status !== "ok",
    };
  },
);

server.registerTool(
  "read_output",
  {
    title: "Read Output",
    description:
      "Read the output of a previous agent spawn. Pass a file path to read it, or omit to list the 10 most recent outputs.",
    inputSchema: z.object({
      path: z
        .string()
        .optional()
        .describe(
          "Absolute path to a specific output file. If omitted, lists recent outputs.",
        ),
    }),
  },
  async ({ path }) => {
    const config = getConfig();

    if (path) {
      return {
        content: [
          { type: "text" as const, text: readOutput(path) },
        ],
      };
    }

    const outputs = listOutputs(config.defaults.output_dir).slice(
      0,
      10,
    );
    if (outputs.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `No outputs found in ${config.defaults.output_dir}`,
          },
        ],
      };
    }

    const lines = outputs.map(
      (o) =>
        `${o.timestamp} [${o.profile}] ${(o.sizeBytes / 1024).toFixed(1)}KB — ${o.path}`,
    );

    return {
      content: [{ type: "text" as const, text: lines.join("\n") }],
    };
  },
);

const SCRIPT_EXEC_ENV = "PROVIDER_AGENTS_ALLOW_SCRIPT_EXEC";
const SCRIPT_EXEC_DISABLED = new Set(["", "0", "false", "off", "no"]);

server.registerTool(
  "register_script",
  {
    title: "Register Script",
    description:
      "Create or overwrite an executable agent-script in agent-scripts/ (chmod +x). " +
      "Include a shebang (e.g. '#!/usr/bin/env bash'); a leading '# description: ...' line is shown by list_scripts. " +
      "Associate it with profiles via add_profile(scripts=[...]). Runnable via run_script (exec is env-gated).",
    inputSchema: z.object({
      name: z.string().describe("Plain filename incl. extension (e.g. 'backup.sh'). No path separators or '..'."),
      content: z.string().describe("Full script source. Start with a shebang so it can be executed directly."),
    }),
  },
  async ({ name, content }) => {
    try {
      const info = writeScript(name, content);
      return { content: [{ type: "text" as const, text: `Script "${info.name}" registered (${info.sizeBytes} B, chmod +x) at ${info.path}` }] };
    } catch (e: unknown) {
      return { content: [{ type: "text" as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
    }
  },
);

server.registerTool(
  "list_scripts",
  {
    title: "List Scripts",
    description: "List registered agent-scripts (name, size, description) from agent-scripts/.",
    inputSchema: z.object({}),
  },
  async () => {
    const scripts = listScripts();
    if (scripts.length === 0) {
      return { content: [{ type: "text" as const, text: "No scripts registered. Create one with register_script." }] };
    }
    const lines = scripts.map((s) => `${s.name} (${(s.sizeBytes / 1024).toFixed(1)}KB)${s.description ? ` — ${s.description}` : ""}`);
    return { content: [{ type: "text" as const, text: lines.join("\n") }] };
  },
);

server.registerTool(
  "get_script",
  {
    title: "Get Script",
    description: "Read the source of a registered agent-script.",
    inputSchema: z.object({ name: z.string().describe("Script filename (e.g. 'backup.sh')") }),
  },
  async ({ name }) => {
    try {
      const content = getScript(name);
      if (content === null) {
        return { content: [{ type: "text" as const, text: `Script "${name}" not found. List with list_scripts.` }], isError: true };
      }
      return { content: [{ type: "text" as const, text: content }] };
    } catch (e: unknown) {
      return { content: [{ type: "text" as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
    }
  },
);

server.registerTool(
  "remove_script",
  {
    title: "Remove Script",
    description: "Delete a registered agent-script from agent-scripts/.",
    inputSchema: z.object({ name: z.string().describe("Script filename to remove") }),
  },
  async ({ name }) => {
    try {
      const removed = removeScript(name);
      return {
        content: [{ type: "text" as const, text: removed ? `Script "${name}" removed.` : `Script "${name}" not found.` }],
        isError: !removed,
      };
    } catch (e: unknown) {
      return { content: [{ type: "text" as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
    }
  },
);

server.registerTool(
  "run_script",
  {
    title: "Run Script",
    description:
      "Execute a registered agent-script and capture its output. SECURITY: this runs code, so it is DISABLED unless " +
      `env ${SCRIPT_EXEC_ENV} is set to a truthy value. Only files registered in agent-scripts/ can run (no arbitrary paths).`,
    inputSchema: z.object({
      name: z.string().describe("Registered script filename to execute (e.g. 'backup.sh')"),
      args: z.array(z.string()).optional().describe("Arguments passed to the script"),
    }),
  },
  async ({ name, args }) => {
    const gate = (process.env[SCRIPT_EXEC_ENV] ?? "").trim().toLowerCase();
    if (SCRIPT_EXEC_DISABLED.has(gate)) {
      return {
        content: [{ type: "text" as const, text: `Script execution is disabled. Set ${SCRIPT_EXEC_ENV}=1 in the MCP env to enable run_script.` }],
        isError: true,
      };
    }
    try {
      const r = await runScript(name, args ?? [], { cwd: process.cwd() });
      const header = `[run_script] name=${name} status=${r.status} exit=${r.exitCode}`;
      const body = [r.stdout && `--- stdout ---\n${r.stdout}`, r.stderr && `--- stderr ---\n${r.stderr}`].filter(Boolean).join("\n");
      return { content: [{ type: "text" as const, text: `${header}\n${body}` }], isError: r.status !== "ok" };
    } catch (e: unknown) {
      return { content: [{ type: "text" as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
    }
  },
);

server.registerTool(
  "list_skills",
  {
    title: "List Skills",
    description: "List available reference skills (design patterns, clean architecture, etc.) that can be assigned to profiles.",
    inputSchema: z.object({}),
  },
  async () => {
    const skills = listSkills();
    if (skills.length === 0) {
      return { content: [{ type: "text" as const, text: "No skills found in skills/ directory." }] };
    }
    const lines = skills.map(s => `${s.name}: ${s.description || "(no description)"}`);
    return { content: [{ type: "text" as const, text: lines.join("\n") }] };
  },
);

server.registerTool(
  "get_skill",
  {
    title: "Get Skill",
    description: "Read a skill's content. Without pattern, returns the SKILL.md index. With pattern, returns a specific pattern file (e.g. 'behavioral/strategy').",
    inputSchema: z.object({
      skill: z.string().describe("Skill name (e.g. 'design-patterns-typescript')"),
      pattern: z.string().optional().describe("Pattern path within the skill (e.g. 'behavioral/strategy')"),
    }),
  },
  async ({ skill, pattern }) => {
    const content = pattern ? getSkillPattern(skill, pattern) : getSkill(skill);
    if (!content) {
      return {
        content: [{ type: "text" as const, text: `Skill "${skill}"${pattern ? ` pattern "${pattern}"` : ""} not found.` }],
        isError: true,
      };
    }
    return { content: [{ type: "text" as const, text: content }] };
  },
);

server.registerTool(
  "suggest_execution",
  {
    title: "Suggest Execution",
    description:
      "Select a role profile and an allowed provider/model target using deterministic, auditable use-case rules.",
    inputSchema: z.object({
      task_description: z.string().describe("Task to route, including relevant complexity and input modality."),
    }),
  },
  async ({ task_description }) => {
    try {
      const config = getConfig();
      const providers = loadProviders(join(globalConfigDir(), "providers.yaml"));
      const suggestion = suggestExecution(task_description, config, providers);
      const lines = [
        `Suggested profile: ${suggestion.profile}`,
        `Provider: ${suggestion.provider}`,
        `Model: ${suggestion.model}`,
        `Confidence: ${suggestion.confidence}`,
        `Reasons: ${suggestion.reasons.join(", ")}`,
        suggestion.alternative
          ? `Alternative: profile=${suggestion.alternative.profile} provider=${suggestion.alternative.provider} model=${suggestion.alternative.model}`
          : "",
        "",
        `Use: spawn_agent(profile="${suggestion.profile}", provider="${suggestion.provider}", model="${suggestion.model}", prompt="<your task>")`,
      ].filter(Boolean);
      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    } catch (e) {
      return { content: [{ type: "text" as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
    }
  },
);

server.registerTool(
  "suggest_profile",
  {
    title: "Suggest Profile",
    description:
      "Given a task description, suggest the best provider-agent profile to handle it. " +
      "Returns the suggested profile name, model, and description. " +
      "When no strong match is found, lists all available profiles.",
    inputSchema: z.object({
      task_description: z
        .string()
        .describe("Description of the task to delegate (e.g. 'review this diff for security vulnerabilities')"),
    }),
  },
  async ({ task_description }) => {
    const config = getConfig();
    const descLower = task_description.toLowerCase();

    const scored: { name: string; profile: Profile; score: number }[] = [];

    for (const [name, profile] of Object.entries(config.profiles)) {
      let score = 0;

      for (const tag of profile.tags ?? []) {
        if (descLower.includes(tag.toLowerCase())) {
          score += 3;
        }
      }

      const descWords = profile.description.toLowerCase().split(/\s+/);
      for (const word of descWords) {
        if (word.length > 3 && descLower.includes(word)) {
          score += 1;
        }
      }

      for (const part of name.split("-")) {
        if (part.length > 2 && descLower.includes(part)) {
          score += 2;
        }
      }

      if (score > 0) {
        scored.push({ name, profile, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);

    if (scored.length === 0 || scored[0].score < 2) {
      const available = Object.entries(config.profiles)
        .map(([name, p]) => `  ${name}: ${p.description}`)
        .join("\n");
      return {
        content: [{
          type: "text" as const,
          text: `No strong match for this task. Available profiles:\n${available}`,
        }],
      };
    }

    const best = scored[0];
    const lines = [
      `Suggested profile: ${best.name}`,
      `Model: ${best.profile.model}`,
      `Description: ${best.profile.description}`,
      best.profile.color ? `Color: ${best.profile.color}` : "",
      "",
      `Use: spawn_agent(profile="${best.name}", prompt="<your task>")`,
    ].filter(Boolean);

    if (scored.length > 1) {
      lines.push("");
      lines.push("Other matches:");
      for (const s of scored.slice(1, 4)) {
        lines.push(`  ${s.name} (score ${s.score}): ${s.profile.description}`);
      }
    }

    return {
      content: [{ type: "text" as const, text: lines.join("\n") }],
    };
  },
);

server.registerTool(
  "archon_run",
  {
    title: "Archon Run",
    description:
      "Run the Archon inference-time ensemble on a HARD task: diverse generators produce " +
      "candidates in parallel, then execution-grounded selection (generated unit tests in a " +
      "sandbox) for code tasks, or fuse/critic/rank/verify for reasoning tasks. " +
      "Slower and costlier than spawn_agent — use only when a single agent is likely to fail. " +
      "The task must be self-contained: agents have no conversation context.",
    inputSchema: z.object({
      task: z
        .string()
        .describe("Self-contained task/problem statement (include code, constraints, examples)"),
      lang: z
        .string()
        .optional()
        .describe("Sandbox language for code tasks (default: python)"),
      generators: z
        .array(z.string())
        .optional()
        .describe("Override generator profile names (default: verified free pool + deepseek anchor)"),
      write_trace: z
        .boolean()
        .optional()
        .describe("Persist a run trace to the Obsidian vault (default: false)"),
    }),
  },
  async ({ task, lang, generators, write_trace }) => {
    const config = getConfig();

    // LLM-provided profile names cross a trust boundary — validate before spawning.
    const requested = generators?.length ? generators : DEFAULT_POOLS.generators;
    const unknown = requested.filter((name) => !config.profiles[name]);
    if (unknown.length > 0) {
      const available = Object.keys(config.profiles).join(", ");
      return {
        content: [
          {
            type: "text" as const,
            text: `Unknown generator profile(s): ${unknown.join(", ")}. Available: ${available || "none"}`,
          },
        ],
        isError: true,
      };
    }

    const pools = generators?.length
      ? { ...DEFAULT_POOLS, generators }
      : DEFAULT_POOLS;

    const result = await runArchon(task, {
      pools,
      lang,
      vaultDir: write_trace ? resolveVaultDir(process.env) : undefined,
    });

    const scores = result.candidates
      .map((c) => `${c.fromProfile}${c.score !== undefined ? ` score=${c.score}` : ""}`)
      .join(", ");
    const header = [
      `[archon] spec=${result.spec.name} trace=${result.traceId}`,
      `[archon] candidates: ${scores || "none"}`,
      "---",
    ].join("\n");

    return {
      content: [{ type: "text" as const, text: `${header}\n${result.answer}` }],
      isError: result.answer.length === 0,
    };
  },
);

async function main() {
  // NB: never write to stdout here — the StdioServerTransport carries the
  // JSON-RPC protocol on stdout, so any console.log corrupts the stream.
  // Diagnostics must go to stderr (console.error).
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e) => {
  console.error("provider-agents: error", e);
  process.exit(1);
});
