
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server";
import * as z from "zod";
import { join } from "node:path";
import { loadMergedConfig, addProjectProfile, removeProjectProfile, globalConfigDir } from "./config.js";
import { spawnAgent } from "./spawner.js";
import { loadProviders } from "./providers.js";
import { listSkills, getSkill, getSkillPattern } from "./skills.js";
import {
  createOutputPath,
  readOutput,
  listOutputs,
  cleanupOldOutputs,
} from "./output.js";
import type { Config, Profile, ClaudePProfile, CliProfile } from "./types.js";
import { autoAddDir, enrichPrompt } from "./prompt-enrichment.js";
import { persistMemoryHook } from "./memory-hook.js";
import { runArchon, DEFAULT_POOLS, resolveVaultDir } from "./archon/index.js";

const server = new McpServer({
  name: "provider-agents",
  version: "0.2.0",
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
      const timeout = profile.timeout ?? 300;
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
    title: "Add Profile",
    description:
      "Create or update a profile in the project .claude/profiles.yaml. Use invocation=claude-p for Anthropic-compatible APIs (requires settings path), or invocation=cli for standalone CLI tools.",
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
        .describe("Path to settings.json (claude-p only; derived as creds/<name>.json when omitted)"),
      provider: z
        .string()
        .optional()
        .describe("Default provider registry key (claude-p only, e.g. 'deepseek', 'moonshot')"),
      permissions: z
        .string()
        .optional()
        .describe("Permission preset name (claude-p only, e.g. 'no-write', 'readonly', 'write-md', 'full')"),
      command: z
        .string()
        .optional()
        .describe("CLI binary name or path (cli only, e.g. 'pplx')"),
      system_prompt: z.string().optional().describe("System prompt text"),
      bare: z.boolean().optional().describe("Disable hooks/plugins (claude-p only, default: false)"),
      stdin: z.boolean().optional().describe("Send prompt via stdin (cli only, default: false)"),
      timeout: z.number().int().min(1).optional().describe("Timeout in seconds (default: 300)"),
      mcp_config: z.array(z.string()).optional().describe("Extra MCP config paths (claude-p only)"),
      args: z.array(z.string()).optional().describe("Extra CLI flags (cli only)"),
    }),
  },
  async ({ name, invocation, model, description, settings, provider, permissions, command, system_prompt, bare, stdin, timeout, mcp_config, args }) => {
    if (invocation === "cli" && !command) {
      return {
        content: [{ type: "text" as const, text: "Error: 'command' is required for invocation=cli." }],
        isError: true,
      };
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
      } satisfies CliProfile;
    } else {
      profile = {
        invocation: "claude-p",
        settings: settings ?? `creds/${name}.json`,
        model,
        provider: provider || undefined,
        permissions: permissions || undefined,
        description,
        system_prompt: system_prompt || undefined,
        bare: bare ?? false,
        timeout,
        mcp_config: mcp_config ?? [],
      } satisfies ClaudePProfile;
    }

    addProjectProfile(process.cwd(), name, profile);

    return {
      content: [{ type: "text" as const, text: `Profile "${name}" [${invocation}] added/updated in .claude/profiles.yaml` }],
    };
  },
);

server.registerTool(
  "remove_profile",
  {
    title: "Remove Profile",
    description: "Remove a profile from the project .claude/profiles.yaml.",
    inputSchema: z.object({
      name: z.string().describe("Profile name to remove"),
    }),
  },
  async ({ name }) => {
    const removed = removeProjectProfile(process.cwd(), name);
    if (!removed) {
      return {
        content: [{ type: "text" as const, text: `Profile "${name}" not found in .claude/profiles.yaml.` }],
        isError: true,
      };
    }

    return {
      content: [{ type: "text" as const, text: `Profile "${name}" removed from .claude/profiles.yaml.` }],
    };
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
    }),
  },
  async ({ profile: profileName, prompt, extra_args, provider }) => {
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
    if (provider) {
      const providers = loadProviders(join(globalConfigDir(), "providers.yaml"));
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

    cleanupOldOutputs(config.defaults.output_dir, 7);
    const outputPath = createOutputPath(
      config.defaults.output_dir,
      profileName,
    );

    const enrichedPrompt = enrichPrompt(prompt, profile.model);
    const enrichedArgs = autoAddDir(profile.invocation, extra_args, process.cwd());

    const result = await spawnAgent(
      profile,
      profileName,
      enrichedPrompt,
      outputPath,
      enrichedArgs,
      process.cwd(),
      provider,
    );

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

    const header = [
      `[provider-agents] status=${result.status} exit=${result.exitCode} duration=${Math.round(result.durationMs / 1000)}s`,
      `[provider-agents] profile=${result.profile} model=${result.model}`,
      `[provider-agents] output=${result.outputPath}`,
      `[provider-agents] auto-memory=${memoryQueued ? "queued" : "skipped"}`,
      "---",
    ].join("\n");

    return {
      content: [
        { type: "text" as const, text: `${header}\n${output}` },
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
