# Provider Agents — Guia de Uso Diário

> Como usar os provider-agents no dia a dia para tirar o máximo proveito,
> economizando tokens do Claude Opus e delegando trabalho pesado para o DeepSeek
> e modelos free do OpenRouter.

## Setup (uma vez)

```bash
# 1. Instalar globalmente
npm install -g provider-agents

# 2. Registrar como MCP server no Claude Code
claude mcp add provider-agents -- provider-agents

# 3. Verificar profiles carregados
# (dentro do Claude Code, o Claude vai ver isso automaticamente)
```

## Quando NÃO delegar (Claude faz melhor)

- Arquivo < 200 linhas que você vai editar em seguida
- Debugging interativo onde o usuário está redirecionando em tempo real
- Revisão de segurança de código crítico (auth, payments) — use Claude-tier
- Multi-step reasoning chains que dependem de análise acumulada
- Arquivos que já estão no contexto

## Quando delegar (provider-agents faz igual ou melhor, mais barato)

### Exploração de código

```
Peça ao Claude: "encontre todos os call sites de processPayment"

O Claude vai usar:
  spawn_agent(profile: "explorer", prompt: "No repo X, encontre todos os call
  sites de processPayment com file:line", extra_args: ["--add-dir", "/repo"])
```

**Profile:** `explorer` (DeepSeek V4 Pro)
**Quando:** buscar call sites, imports, dependências, mapear fluxo de dados.

### Code review

```
Peça ao Claude: "revise o diff da minha branch"

O Claude vai usar:
  spawn_agent(profile: "reviewer", prompt: "<diff aqui>\n\nRevise este diff...")
```

**Profile:** `reviewer` (DeepSeek V4 Pro)
**Quando:** revisão de PR, busca de bugs, regressões. Passe o diff no prompt.

Para revisão de segurança: `security-reviewer` (checklist OWASP Top 10 embutido).

### Geração de código

```
Peça ao Claude: "gere um middleware de rate limiting para Express"

O Claude vai usar:
  spawn_agent(profile: "coder", prompt: "Gere um middleware Express de rate
  limiting com sliding window. O projeto usa TypeScript, Express 5, Redis.")
```

**Profile:** `coder` (DeepSeek V4 Pro)
**Quando:** scaffolding, handlers, endpoints, testes. Inclua stack e convenções.

### Debugging e RCA

```
Peça ao Claude: "analise este stack trace"

O Claude vai usar:
  spawn_agent(profile: "analyst", prompt: "<stack trace>\n\nFaça root cause
  analysis deste erro. Quais são as hipóteses mais prováveis?")
```

**Profile:** `analyst` (DeepSeek V4 Pro, DeepThink mode)
**Quando:** debugging complexo, análise de impacto, trade-offs arquiteturais.

### Pesquisa técnica

```
Peça ao Claude: "compare Prisma vs Drizzle para o nosso projeto"

O Claude vai usar:
  spawn_agent(profile: "researcher", prompt: "Compare Prisma vs Drizzle para
  um projeto TypeScript + PostgreSQL. Considere: performance, DX, migração...")
```

**Profile:** `researcher` (DeepSeek V4 Pro)
**Quando:** comparar libs/frameworks, investigar alternativas, avaliar migração.

### Análise de logs grandes (>200 linhas)

```
Peça ao Claude: "analise o log de deploy e me diga o que deu errado"

O Claude vai usar:
  spawn_agent(profile: "analyst", prompt: "Leia /path/to/deploy.log e extraia:
  1. Todos os erros com timestamp
  2. A primeira falha que causou o cascading failure
  3. Resumo da timeline do incidente
  Retorne um resumo estruturado, NÃO o log raw.")
```

**Importante:** instrua o agente a retornar **resumo**, não o conteúdo raw.

### Tarefas grátis (zero custo)

```
Peça ao Claude: "gere esse boilerplate com um modelo free"

O Claude vai usar:
  spawn_agent(profile: "openrouter-coder", prompt: "...")    # Laguna M.1
  spawn_agent(profile: "openrouter-reasoning", prompt: "...")  # Nemotron 550B
  spawn_agent(profile: "openrouter-quick", prompt: "...")      # triagem rápida
```

**Quando:** tarefas simples onde custo zero importa mais que tooling.
Limitação: são chat-only (sem acesso a arquivos do disco).

## Revisão por linguagem (com LSP)

Para revisões profundas que usam go-to-definition, find-references e hover:

| Profile | Linguagem | Extras |
|---|---|---|
| `ts-reviewer` | TypeScript/JS | design patterns + unit testing skills |
| `python-reviewer` | Python | unit testing patterns |
| `csharp-reviewer` | C#/.NET | clean architecture + design patterns |

## Refatoração

```
Peça ao Claude: "encontre dead code neste módulo"

O Claude vai usar:
  spawn_agent(profile: "refactorer", prompt: "Analise o módulo em /path/to/src
  e identifique: exports não usados, imports mortos, código duplicado...")
```

**Profile:** `refactorer` (DeepSeek V4 Pro)
**Quando:** limpeza, dead code, consolidação, simplificação.

## Ensemble Archon (código difícil)

Para problemas de código complexos onde um modelo só pode errar, o Archon
gera N candidatos com modelos diversos e seleciona o melhor via execução
de testes no sandbox:

```bash
# Via tool MCP: archon_run(task="...") — ou via script de eval:
EVAL_N=5 npx tsx eval/run-eval.ts   # HumanEval
EVAL_N=5 npx tsx eval/run-mbpp.ts   # MBPP
```

Generators: `gen-gptoss` (OpenAI 120B), `gen-nemotron-super` (Nvidia 120B),
`gen-gemma` (Google 31B), `gen-laguna` (Poolside M.1) — todos FREE.

## Mapa rápido: qual profile usar?

| Tarefa | Profile | Custo |
|---|---|---|
| Buscar código, call sites | `explorer` | DeepSeek (pago) |
| Revisar diff/PR | `reviewer` | DeepSeek (pago) |
| Gerar código/scaffolding | `coder` | DeepSeek (pago) |
| Debugging, RCA, logs | `analyst` | DeepSeek (pago) |
| Comparar libs/docs | `researcher` | DeepSeek (pago) |
| Segurança (OWASP) | `security-reviewer` | DeepSeek (pago) |
| Refatoração/cleanup | `refactorer` | DeepSeek (pago) |
| Review TS com LSP | `ts-reviewer` | DeepSeek (pago) |
| Review Python com LSP | `python-reviewer` | DeepSeek (pago) |
| Review C# com LSP | `csharp-reviewer` | DeepSeek (pago) |
| Geração free | `openrouter-coder` | FREE |
| Review free | `openrouter-reviewer` | FREE |
| Análise free (976K ctx) | `openrouter-reasoning` | FREE |
| Triagem rápida free | `openrouter-quick` | FREE |
| Ensemble (código difícil) | Archon pipeline | FREE (generators) |

## O que é automatizado (você não precisa lembrar)

O módulo `prompt-enrichment` cuida disso transparentemente a cada spawn:

- **`--add-dir <cwd>` automático** — profiles claude-p recebem acesso ao repo
  do chamador sem precisar de `extra_args` manual.
- **XML tags `<task>`** — prompts para DeepSeek são wrappados automaticamente.
- **Anti-patterns removidos** — "pense passo a passo" / "think step by step"
  são stripados do prompt (degradam DeepThink).
- **Nudge de output estruturado** — adicionado automaticamente para DeepSeek.

## Dicas de prompt (o que ainda vale fazer manualmente)

1. **Inclua stack e convenções** quando pedir código — o agente não sabe nada
   do projeto sem o prompt dizer.
2. **Peça resumo, não raw** — instrua o agente a retornar dados estruturados
   ("liste os 5 erros com file:line"), não o conteúdo inteiro.
3. **Para acesso a repos fora do cwd**, passe `extra_args: ["--add-dir", "/outro/repo"]`.

## Segurança dos profiles

| Settings file | Profiles | Pode ler? | Pode grep/git? | Pode editar? |
|---|---|---|---|---|
| `deepseek.json` | deepseek, deepseek-1m, coder, analyst, *-reviewer (linguagem) | Texto só | Não | Não |
| `deepseek-readonly.json` | explorer, reviewer, researcher, security-reviewer, refactorer | Sim | Sim | Não |

Nenhum profile tem permissão de Write/Edit. Secrets (.env, .pem, .ssh) são
bloqueados em ambos os settings files.
