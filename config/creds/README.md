# Credenciais dos profiles (NÃO versionadas)

Este diretório guarda os settings JSON com credenciais de API dos profiles
`claude-p`. Os `*.json` aqui são **gitignored** — nunca commitar segredo.

O diretório `~/.config/provider-agents/creds` é um symlink para cá, então o
`config/profiles.yaml` referencia os arquivos por path portável
`~/.config/provider-agents/creds/<arquivo>.json` e tudo resolve para este
local físico dentro do repo.

## Arquivos esperados (crie localmente, chmod 600)

| Arquivo | Usado por | Conteúdo |
|---|---|---|
| `deepseek.json` | deepseek, deepseek-1m, coder, analyst, ts/python/csharp-reviewer | `env` com `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BASE_URL`, `ANTHROPIC_MODEL` + `permissions.deny` (Write/Edit/Bash/secrets) |
| `deepseek-readonly.json` | explorer, reviewer, researcher, security-reviewer, refactorer | idem, mas `permissions.allow` grep/find/git + `Read` |
| `kimi.json` | (nenhum profile ativo — reservado) | credenciais Kimi, se um profile Kimi real for criado |

Formato mínimo:

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "sk-YOUR_KEY",
    "ANTHROPIC_BASE_URL": "https://api.deepseek.com/anthropic",
    "ANTHROPIC_MODEL": "deepseek-v4-pro"
  },
  "permissions": { "deny": ["Write", "Edit", "NotebookEdit", "Bash", "Read(**/.env)", "Read(**/*.pem)"] }
}
```

Após criar: `chmod 600 config/creds/*.json`.
