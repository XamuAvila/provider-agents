# Credenciais dos profiles (NÃO versionadas)

Neste modelo os dois eixos ficam separados:

- **`secrets.json`** — a **key unificada**: o token de API por provider. É o
  **único** lugar onde o segredo vive. `gitignored`, `chmod 600`.
- **`<profile>.json`** — settings **gerados** por `scripts/gen-creds.ts`, contendo
  **apenas `permissions`** (sem segredo). Derivados de `config/profiles.yaml`
  (`permissions: <preset>`) + `config/permission-presets.yaml`. Também gitignored
  (são artefatos gerados; a fonte de verdade é o script + os YAMLs).

O `env` do provider (token + `ANTHROPIC_BASE_URL` + tuning) **não** fica nestes
arquivos: é montado em runtime pelo spawner a partir de `secrets.json` +
`config/providers.yaml` e injetado no process env do agente filho (o process env
tem precedência sobre o bloco `env` do settings.json — doc oficial do Claude Code).

O diretório `~/.config/provider-agents/creds` é um symlink para cá.

## Setup local (uma vez)

```bash
# 1. Popular secrets.json a partir dos creds legados (nunca imprime o token):
npx tsx scripts/bootstrap-secrets.ts
chmod 600 config/creds/secrets.json

# 2. Gerar os creds de permissão (config/creds/<profile>.json):
npx tsx scripts/gen-creds.ts
```

Formato do `secrets.json` (um token por provider — chaves = keys de
`config/providers.yaml`):

```json
{
  "deepseek": { "ANTHROPIC_AUTH_TOKEN": "sk-..." },
  "moonshot": { "ANTHROPIC_AUTH_TOKEN": "sk-..." }
}
```

Formato de um cred gerado (`<profile>.json`) — só permissions, sem segredo:

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "permissions": { "deny": ["Write", "Edit", "Read(**/.env)", "..."] }
}
```

## Arquivos

| Arquivo | Versionado? | Conteúdo |
|---|---|---|
| `secrets.json` | não (600) | token por provider — a key unificada, único segredo |
| `<profile>.json` | não (gerado) | só `permissions`, materializado por `gen-creds` |
| `README.md` | sim | este arquivo |

> Legado: `deepseek.json`, `deepseek-readonly.json`, `deepseek-memory.json`,
> `deepseek-all.json`, `kimi.json` são pré-migração (token + permissions juntos).
> Ficam como fonte do bootstrap; remover num commit separado após validar.
