# provider-agents

MCP server that spawns isolated LLM agent sessions across multiple providers.

Delegate tasks to DeepSeek, Kimi, Codex, or any Anthropic-compatible API without consuming the quota of your primary model. Each spawn runs as a separate process with its own context, tools, and settings.

## Install

```bash
npm install -g provider-agents
```

## Setup

### 1. Add to Claude Code

```bash
claude mcp add provider-agents -- provider-agents
```

### 2. Create profiles

**Global** (`~/.config/provider-agents/profiles.yaml`):

```yaml
defaults:
  output_dir: /tmp/provider-agents

profiles:
  deepseek:
    invocation: claude-p
    settings: ~/.config/provider-agents/deepseek.json
    model: deepseek-v4-pro
    description: DeepSeek. High coding performance.
```

**Project** (`.claude/profiles.yaml`) overrides global profiles with the same name.

### 3. Create settings files

Each `claude-p` profile needs a settings JSON with API credentials:

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "sk-YOUR_KEY",
    "ANTHROPIC_BASE_URL": "https://api.deepseek.com/anthropic",
    "ANTHROPIC_MODEL": "deepseek-v4-pro"
  }
}
```

## Tools

| Tool | Description |
|------|-------------|
| `spawn_agent` | Spawn an isolated agent session with a configured profile |
| `list_profiles` | List available profiles (global + project merged) |
| `read_output` | Read previous spawn output or list recent outputs |
| `add_profile` | Create or update a profile in the project `.claude/profiles.yaml` |
| `remove_profile` | Remove a profile from the project `.claude/profiles.yaml` |
| `suggest_profile` | Suggest the best profile for a task description (tag/keyword scoring) |
| `list_skills` | List reference skills that can be assigned to profiles |
| `get_skill` | Read a skill's index or a specific pattern file |
| `archon_run` | Run the Archon inference-time ensemble (generate → verify/test-select) |

## Profile Schema

### `invocation: claude-p`

| Field | Required | Description |
|-------|----------|-------------|
| `settings` | yes | Path to settings JSON with API credentials |
| `model` | yes | Model ID |
| `system_prompt` | no | System prompt |
| `bare` | no | Disable hooks/plugins (default: false) |
| `timeout` | no | Seconds (default: 300) |
| `mcp_config` | no | Extra MCP server config paths |
| `allowed_tools` | no | Restrict available tools |

### `invocation: cli`

| Field | Required | Description |
|-------|----------|-------------|
| `command` | yes | Binary name or path |
| `model` | yes | Model ID |
| `system_prompt` | no | System prompt |
| `stdin` | no | Send prompt via stdin (default: false) |
| `timeout` | no | Seconds (default: 300) |
| `args` | no | Extra CLI flags |

## License

MIT
