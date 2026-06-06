#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server";
import * as z from "zod";
import { loadMergedConfig } from "./config.js";
import { spawnAgent } from "./spawner.js";
import {
  createOutputPath,
  readOutput,
  listOutputs,
  cleanupOldOutputs,
} from "./output.js";
import type { Config } from "./types.js";

const server = new McpServer({
  name: "provider-agents",
  version: "0.1.0",
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
  "spawn_agent",
  {
    title: "Spawn Agent",
    description:
      "Spawn an isolated agent session using a configured provider profile. The agent runs as a separate process (claude -p or standalone CLI) and its output is captured to a file. Returns the full output and metadata.",
    inputSchema: z.object({
      profile: z
        .string()
        .describe(
          "Profile name from profiles.yaml (e.g. 'deepseek', 'kimi', 'codex')",
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
    }),
  },
  async ({ profile: profileName, prompt, extra_args }) => {
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

    cleanupOldOutputs(config.defaults.output_dir, 7);
    const outputPath = createOutputPath(
      config.defaults.output_dir,
      profileName,
    );

    const result = await spawnAgent(
      profile,
      profileName,
      prompt,
      outputPath,
      extra_args,
    );

    const output = readOutput(result.outputPath);

    const header = [
      `[provider-agents] status=${result.status} exit=${result.exitCode} duration=${Math.round(result.durationMs / 1000)}s`,
      `[provider-agents] profile=${result.profile} model=${result.model}`,
      `[provider-agents] output=${result.outputPath}`,
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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
