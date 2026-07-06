# agent-scripts

Executable agent-scripts registered and run through the provider-agents MCP.

- One executable file per script (shell/node/python/…). **Start each with a
  shebang** (e.g. `#!/usr/bin/env bash`) — `run_script` spawns the file directly.
- A leading `# description: ...` (or `// description: ...`) line is surfaced by
  `list_scripts`.
- Managed via MCP tools: `register_script`, `list_scripts`, `get_script`,
  `remove_script`, `run_script`.
- Associate scripts with a profile via `add_profile(scripts=[...])` (stored as
  `scripts: []` on the profile in `config/profiles.yaml`).
- Associated scripts are listed with absolute paths in that profile's prompt;
  `claude-p` also receives the scripts directory through `--add-dir`. Execution
  remains subject to the profile's Bash permissions.

## Included utilities

- `repo-facts.mjs`: stack and declared verification commands.
- `changed-context.sh`: branch, worktree status, diff stats, recent commits.
- `patch-sanity.sh`: whitespace, conflict markers, and large added files.
- `semble-search.sh`: direct Semble CLI search with a writable isolated cache.
- `mermaid-debug-html.mjs`: Mermaid source to styled debugging HTML under `/tmp`.

## Security

- Names are validated: a plain filename only — no path separators or `..`, so a
  script can only ever address a file **inside** this folder.
- `run_script` executes code, so it is **disabled by default**. Enable it by
  setting `PROVIDER_AGENTS_ALLOW_SCRIPT_EXEC=1` in the MCP server env.
- This folder is deliberately separate from the repo's build `scripts/`
  (gen-creds, bootstrap-secrets) so `run_script` can never execute build tooling.
