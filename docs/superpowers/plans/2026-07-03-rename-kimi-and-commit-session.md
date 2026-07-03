# Rename `kimi` → `deepseek-1m` + Commits da Sessão — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Commitar todo o trabalho pendente da working tree em commits lógicos e renomear o profile `kimi` (enganoso — roda DeepSeek) para `deepseek-1m` em todas as referências.

**Architecture:** Commits do trabalho existente primeiro (Tasks 1-4), rename depois como commit dedicado (Task 5) — assim o rename aparece no histórico como diff próprio, não diluído nos commits de features. Nenhum código novo; só git + edições de texto.

**Tech Stack:** git, TypeScript (Vitest para verificação), YAML.

## Global Constraints

- Repo root: `/home/samuel/Documentos/pessoal/provider-agents`. Todos os comandos rodam de lá.
- NUNCA usar `git add -A` ou `git add .` — sempre paths explícitos (a working tree contém arquivos de outros trabalhos).
- Antes de CADA commit: `npm run typecheck` e `npm test` verdes.
- Toda mensagem de commit termina com estas duas linhas (trailer obrigatório):
  ```
  Co-Authored-By: samuel-avila-blis <samuel.avila@blisai.com>
  Claude-Session: https://claude.ai/code/session_01SWFDPZn6zDG3YT6m4Bwu4L
  ```
- Branch: `master` (autorizado pelo usuário — "pode ser tudo aqui").
- NÃO tocar: `tests/fixtures/global-profiles.yaml` (o profile `shared-kimi` com model `kimi-k2.5` é fixture sintética de teste de merge — não é o profile real) nem `tests/config.test.ts:58-59` (asserts dessa fixture). NÃO editar docs históricos (`docs/superpowers/plans/2026-06-23-coordinator-sakana.md`).
- `~/.claude/rules/common/token-delegation.md` fica FORA do repo — editar o arquivo, não commitar (não é deste git).

---

### Task 1: Commit A — prompt enrichment + mcp_config path resolution

**Files:**
- Commit (já existentes na tree, sem edição): `src/prompt-enrichment.ts`, `src/prompt-enrichment.test.ts`, `src/config.ts`, `tests/config.test.ts`

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces: baseline commitado para os commits seguintes.

- [ ] **Step 1: Verificar suite verde**

Run: `npm run typecheck && npm test 2>&1 | tail -3`
Expected: typecheck sem output de erro; `Test Files  21 passed (21)` e `Tests  129 passed (129)`.

- [ ] **Step 2: Stage + commit**

```bash
git add src/prompt-enrichment.ts src/prompt-enrichment.test.ts src/config.ts tests/config.test.ts
git commit -m "$(cat <<'EOF'
feat: prompt enrichment + mcp_config path resolution

- enrichPrompt: XML <task> wrap p/ DeepSeek, strip de anti-patterns
  ("think step by step" degrada DeepThink), nudge de output estruturado
- autoAddDir: injeta --add-dir <cwd> automático em profiles claude-p
- resolveProfilePaths agora resolve ~ e paths relativos tambem em
  mcp_config (antes so em settings)

Co-Authored-By: samuel-avila-blis <samuel.avila@blisai.com>
Claude-Session: https://claude.ai/code/session_01SWFDPZn6zDG3YT6m4Bwu4L
EOF
)"
```

- [ ] **Step 3: Verificar commit limpo**

Run: `git --no-pager show --stat HEAD | head -10`
Expected: exatamente os 4 arquivos acima no commit.

### Task 2: Commit B — eval MBPP

**Files:**
- Commit (já existentes, sem edição): `eval/mbpp.ts`, `eval/mbpp.test.ts`, `eval/run-mbpp.ts`, `eval/tasks/mbpp-subset.jsonl`, `eval/tasks/mbpp-systematic.jsonl`, `eval/tasks/mbpp-wide.jsonl`

**Interfaces:**
- Consumes: Task 1 commitada (ordem apenas para histórico linear).
- Produces: eval MBPP versionado.

- [ ] **Step 1: Stage + commit**

```bash
git add eval/mbpp.ts eval/mbpp.test.ts eval/run-mbpp.ts eval/tasks/mbpp-subset.jsonl eval/tasks/mbpp-systematic.jsonl eval/tasks/mbpp-wide.jsonl
git commit -m "$(cat <<'EOF'
feat(eval): MBPP benchmark harness

Espelha o harness HumanEval existente: parser de tasks JSONL,
runner single-agent vs ensemble Archon, subsets subset/systematic/wide.

Co-Authored-By: samuel-avila-blis <samuel.avila@blisai.com>
Claude-Session: https://claude.ai/code/session_01SWFDPZn6zDG3YT6m4Bwu4L
EOF
)"
```

- [ ] **Step 2: Verificar**

Run: `git --no-pager show --stat HEAD | head -10`
Expected: os 6 arquivos de eval no commit.

### Task 3: Commit C — docs pré-existentes + este plano

**Files:**
- Commit (sem edição): `docs/daily-usage-guide.md`, `docs/superpowers/plans/2026-06-26-semble-explorer-only.md`, `docs/superpowers/plans/2026-07-03-rename-kimi-and-commit-session.md`

**Interfaces:**
- Consumes: nada.
- Produces: docs versionados. NOTA: `daily-usage-guide.md` ainda contém o nome `kimi` e a linha "ainda não é tool MCP" — corrigidos na Task 5; aqui commit do estado atual.

- [ ] **Step 1: Stage + commit**

```bash
git add docs/daily-usage-guide.md docs/superpowers/plans/2026-06-26-semble-explorer-only.md docs/superpowers/plans/2026-07-03-rename-kimi-and-commit-session.md
git commit -m "$(cat <<'EOF'
docs: guia de uso diario, plano semble explorer-only, plano rename kimi

Co-Authored-By: samuel-avila-blis <samuel.avila@blisai.com>
Claude-Session: https://claude.ai/code/session_01SWFDPZn6zDG3YT6m4Bwu4L
EOF
)"
```

- [ ] **Step 2: Verificar**

Run: `git --no-pager show --stat HEAD | head -8`
Expected: os 3 arquivos de docs no commit.

### Task 4: Commit D — config unificada + tool archon_run

**Files:**
- Commit (sem edição): `config/profiles.yaml`, `src/index.ts`, `README.md`, `docs/superpowers/specs/2026-07-03-swarm-blackboard-deferred.md`

**Interfaces:**
- Consumes: Task 1 commitada (src/index.ts importa `./prompt-enrichment.js`).
- Produces: estado pré-rename de `config/profiles.yaml` e `src/index.ts` no histórico (a Task 5 edita ambos).

- [ ] **Step 1: Verificar suite verde**

Run: `npm run typecheck && npm test 2>&1 | tail -3`
Expected: typecheck limpo; 129 tests passed.

- [ ] **Step 2: Stage + commit**

```bash
git add config/profiles.yaml src/index.ts README.md docs/superpowers/specs/2026-07-03-swarm-blackboard-deferred.md
git commit -m "$(cat <<'EOF'
feat: config unificada no repo + tool MCP archon_run

- config/profiles.yaml = fonte de verdade (symlink em
  ~/.config/provider-agents/profiles.yaml); credenciais movidas para
  ~/.config/provider-agents/creds/*.json (fora do git, chmod 600)
- registra archon_run: ensemble Archon (generate -> unittest-select p/
  codigo, fuse/critic/rank/verify p/ reasoning) via runArchon; valida
  nomes de generators contra a config antes de spawnar
- README: documenta as 9 tools
- decisao registrada: swarm blackboard (Fase 3) adiado

Co-Authored-By: samuel-avila-blis <samuel.avila@blisai.com>
Claude-Session: https://claude.ai/code/session_01SWFDPZn6zDG3YT6m4Bwu4L
EOF
)"
```

- [ ] **Step 3: Verificar working tree limpa (exceto artefatos ignorados)**

Run: `git status --short`
Expected: saída vazia (tudo commitado; `dist/`, `build/`, `.superpowers/` são ignorados).

### Task 5: Rename `kimi` → `deepseek-1m` + commit E

**Files:**
- Modify: `config/profiles.yaml` (linhas 50, 75-78, 91, 137)
- Modify: `src/index.ts:72` e `src/index.ts:177` (exemplos em descrições de tools)
- Modify: `docs/daily-usage-guide.md` (linha 207 e seção Archon ~linha 155)
- Modify (FORA do repo, sem commit): `~/.claude/rules/common/token-delegation.md:65`

**Interfaces:**
- Consumes: Tasks 1-4 commitadas (o diff do rename fica isolado).
- Produces: profile `deepseek-1m` (mesma config, novo nome). Nenhum código referencia o nome `kimi` — só YAML, docs e strings de exemplo.

- [ ] **Step 1: Renomear a chave do profile em config/profiles.yaml**

Trocar (linha 137):
```yaml
  kimi:
```
por:
```yaml
  deepseek-1m:
```

- [ ] **Step 2: Corrigir comentários que citam o profile 'kimi' em config/profiles.yaml**

Linha 50 — trocar:
```
#   - kimi (kimi-k2.6 general) — o kimi CLI só registra 'kimi-for-coding' (K2.7 Code).
```
por:
```
#   - deepseek-1m (ex-'kimi', renomeado 2026-07-03) — deepseek-v4-pro[1m] via claude-p.
```

Linhas 75-78 — trocar o bloco:
```
# Kimi K2.6 (API/claude-p — profile 'kimi'):
#   - Mesmas regras do K2.7 acima; é o general-purpose recomendado pelo Moonshot.
#   - Bom para conversas longas: se contexto encher, resuma rounds anteriores no system message.
```
por:
```
# (histórico) O profile 'kimi' foi renomeado para 'deepseek-1m' em 2026-07-03:
#   roda deepseek-v4-pro[1m] via claude-p — vale a guidance do DeepSeek acima.
```

Linha 91 — trocar:
```
#   - kimi              → contexto muito longo, síntese e análise ampla.
```
por:
```
#   - deepseek-1m       → contexto muito longo, síntese e análise ampla.
```

- [ ] **Step 3: Atualizar exemplos em src/index.ts**

Linha 72 — trocar:
```typescript
        .describe("Profile name (e.g. 'deepseek', 'kimi', 'codex')"),
```
por:
```typescript
        .describe("Profile name (e.g. 'deepseek', 'explorer', 'codex')"),
```

Linha 177 — trocar:
```typescript
          "Profile name from profiles.yaml (e.g. 'deepseek', 'kimi', 'codex')",
```
por:
```typescript
          "Profile name from profiles.yaml (e.g. 'deepseek', 'explorer', 'codex')",
```

- [ ] **Step 4: Atualizar docs/daily-usage-guide.md**

Linha 207 — trocar:
```
| `deepseek.json` | deepseek, kimi, coder, analyst, *-reviewer (linguagem) | Texto só | Não | Não |
```
por:
```
| `deepseek.json` | deepseek, deepseek-1m, coder, analyst, *-reviewer (linguagem) | Texto só | Não | Não |
```

Na seção "Ensemble Archon" (~linha 155) — trocar:
```
# Via script (ainda não é tool MCP — roadmap)
```
por:
```
# Via tool MCP: archon_run(task="...") — ou via script de eval:
```

- [ ] **Step 5: Atualizar regra global (fora do repo, NÃO commitar)**

Em `~/.claude/rules/common/token-delegation.md` linha 65 — trocar:
```
| General reasoning, 1M context | `kimi` | DeepSeek V4 Pro [1m] | Long context synthesis (historical name; runs DeepSeek) |
```
por:
```
| General reasoning, 1M context | `deepseek-1m` | DeepSeek V4 Pro [1m] | Long context synthesis (renamed from `kimi` 2026-07-03) |
```

- [ ] **Step 6: Verificar rename completo e config carregando**

Run:
```bash
grep -rn "kimi" config/profiles.yaml src/index.ts docs/daily-usage-guide.md | grep -v "kimi-for-coding\|kimi.json\|kimi = OAuth\|kimi-code\|platform.kimi.ai\|Kimi K2.7\|ex-'kimi'\|renomeado\|renamed"
```
Expected: saída vazia (restam só referências ao ecossistema Kimi real — CLI, creds kimi.json, docs Moonshot — nunca ao profile antigo).

Run:
```bash
npx tsx -e "
import { loadMergedConfig } from './src/config.ts';
const c = loadMergedConfig(process.cwd());
console.log('deepseek-1m?', 'deepseek-1m' in c.profiles, '| kimi?', 'kimi' in c.profiles, '| total:', Object.keys(c.profiles).length);
"
```
Expected: `deepseek-1m? true | kimi? false | total: 21`

- [ ] **Step 7: Suite verde**

Run: `npm run typecheck && npm test 2>&1 | tail -3`
Expected: typecheck limpo; `Tests  129 passed (129)` (fixture `shared-kimi` intocada continua passando).

- [ ] **Step 8: Commit E**

```bash
git add config/profiles.yaml src/index.ts docs/daily-usage-guide.md
git commit -m "$(cat <<'EOF'
refactor: renomeia profile kimi -> deepseek-1m

Nome era enganoso: o profile roda deepseek-v4-pro[1m] (settings
deepseek.json), nao um modelo Kimi. Fixture de teste 'shared-kimi'
mantida (dado sintetico de merge, nao o profile real).

Co-Authored-By: samuel-avila-blis <samuel.avila@blisai.com>
Claude-Session: https://claude.ai/code/session_01SWFDPZn6zDG3YT6m4Bwu4L
EOF
)"
```

- [ ] **Step 9: Verificação final do histórico**

Run: `git --no-pager log --oneline -6 && git status --short`
Expected: 5 commits novos no topo (A, B, C, D, E) e working tree limpa.
