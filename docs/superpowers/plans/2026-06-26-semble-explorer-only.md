# Mover semble MCP para o explorer (provider-agents) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tirar o MCP `semble` do escopo global do Claude Code (onde sobe em TODA sessão e acumula processos órfãos) e registrá-lo exclusivamente no perfil `explorer` do provider-agents, que roda em `claude-p` de vida curta.

**Architecture:** O `semble` deixa de ser um `mcpServers` de escopo *User* no `~/.claude.json`. Em vez disso, um arquivo `semble.mcp.json` (formato `{"mcpServers":{...}}`) é referenciado pelo campo `mcp_config` do perfil `explorer` em `profiles.yaml`. O `spawner.ts` do provider-agents injeta esse arquivo como `--mcp-config <path>` ao invocar `claude-p`, então o semble só sobe quando o explorer é chamado e morre quando o `claude-p` (bare, timeout 300s) encerra.

**Tech Stack:** Claude Code CLI (`claude mcp`, `--mcp-config`), provider-agents (TypeScript, `src/spawner.ts`), YAML (`profiles.yaml`), `uvx` (runtime do semble).

## Global Constraints

- **Bloco semble canônico** (copiar verbatim onde precisar):
  ```json
  {"type":"stdio","command":"uvx","args":["--from","semble[mcp]","semble"],"env":{}}
  ```
- **Escopo atual do semble**: `User config` (confirmado via `claude mcp get semble`).
- **Ordem inviolável**: NÃO remover o semble do global (Task 4) antes de o explorer comprovadamente acessá-lo (Task 3 verde). Sem isso, a sessão principal fica sem busca de código sem substituto funcionando.
- **`profiles.yaml`** é symlink para `/home/samuel/Documentos/blis/repos/deepclaude/.claude/profiles.yaml`. NÃO é repositório git → editar direto, sem commit. Editar o arquivo real (o symlink resolve sozinho).
- **`~/.claude.json` NÃO deve ser editado à mão** — é reescrito pelo Claude Code em runtime; usar sempre `claude mcp <cmd>`.
- **Caminho do mcp-config**: `~/.config/provider-agents/semble.mcp.json` (o `config.ts:88` expande `~/` em paths de perfil).

---

### Task 1: Criar o arquivo de MCP isolado do semble

**Files:**
- Create: `/home/samuel/.config/provider-agents/semble.mcp.json`

**Interfaces:**
- Produces: arquivo JSON no formato `{"mcpServers":{"semble":{...}}}` consumível por `claude --mcp-config`. Caminho fixo `~/.config/provider-agents/semble.mcp.json` usado por Task 2 e Task 3.

- [ ] **Step 1: Verificar o estado atual (semble global, deve existir)**

Run: `claude mcp get semble`
Expected: bloco com `Scope: User config` e `Command: uvx` / `Args: --from semble[mcp] semble`. (Se já não existir, PARAR — o estado divergiu do plano.)

- [ ] **Step 2: Criar o arquivo semble.mcp.json**

Escrever em `/home/samuel/.config/provider-agents/semble.mcp.json`:

```json
{
  "mcpServers": {
    "semble": {
      "type": "stdio",
      "command": "uvx",
      "args": ["--from", "semble[mcp]", "semble"],
      "env": {}
    }
  }
}
```

- [ ] **Step 3: Validar que é JSON bem-formado**

Run: `python3 -c "import json; print(list(json.load(open('/home/samuel/.config/provider-agents/semble.mcp.json'))['mcpServers'].keys()))"`
Expected: `['semble']`

---

### Task 2: Smoke test — semble carrega sob claude-p via --mcp-config

Prova que o mecanismo `--mcp-config` carrega o semble num processo `claude-p` isolado, ANTES de mexer em qualquer config persistente do explorer ou do global.

**Files:**
- (nenhum — teste de runtime)

**Interfaces:**
- Consumes: `~/.config/provider-agents/semble.mcp.json` (Task 1).

- [ ] **Step 1: Rodar claude-p isolado pedindo as ferramentas MCP disponíveis**

Run:
```bash
claude -p --mcp-config ~/.config/provider-agents/semble.mcp.json --strict-mcp-config \
  "Liste APENAS os nomes das ferramentas MCP que você tem disponíveis agora. Uma por linha."
```
Expected: a saída menciona ferramenta(s) `semble` (ex.: `mcp__semble__search`). `--strict-mcp-config` garante que só o semble.mcp.json é carregado, isolando o teste de configs globais.

- [ ] **Step 2: Confirmar que sobe processo semble durante a chamada e encerra depois**

Run (logo após o Step 1 terminar):
```bash
sleep 2; pgrep -fc "bin/semble" || echo "0 instancias residuais do teste"
```
Expected: a contagem NÃO aumentou de forma persistente por causa do teste (o `claude -p` encerra e leva o filho MCP junto). Anotar a contagem-base atual de sembles para comparação na Task 5.

---

### Task 3: Registrar semble no perfil explorer e validar end-to-end

**Files:**
- Modify: `/home/samuel/Documentos/blis/repos/deepclaude/.claude/profiles.yaml` (perfil `explorer`, campo `mcp_config`)

**Interfaces:**
- Consumes: `~/.config/provider-agents/semble.mcp.json` (Task 1).
- Produces: perfil `explorer` com `mcp_config: ["~/.config/provider-agents/semble.mcp.json"]`, lido por `config.ts` e injetado por `spawner.ts:28-29` como `--mcp-config`.

- [ ] **Step 1: Confirmar estado atual do explorer (mcp_config vazio)**

Run:
```bash
python3 -c "import yaml; print('mcp_config =', yaml.safe_load(open('/home/samuel/.config/provider-agents/profiles.yaml'))['profiles']['explorer'].get('mcp_config'))"
```
Expected: `mcp_config = []` (estado de partida; se já tiver conteúdo, PARAR e revisar).

- [ ] **Step 2: Editar o perfil explorer**

No arquivo real `/home/samuel/Documentos/blis/repos/deepclaude/.claude/profiles.yaml`, localizar o bloco `explorer:` e trocar a linha `mcp_config: []` por:

```yaml
mcp_config:
  - ~/.config/provider-agents/semble.mcp.json
```

- [ ] **Step 3: Validar que o YAML continua parseável e o caminho foi gravado**

Run:
```bash
python3 -c "import yaml; print('mcp_config =', yaml.safe_load(open('/home/samuel/.config/provider-agents/profiles.yaml'))['profiles']['explorer']['mcp_config'])"
```
Expected: `mcp_config = ['~/.config/provider-agents/semble.mcp.json']`

- [ ] **Step 4: Teste end-to-end — spawnar o explorer e exigir uso do semble**

Invocar o provider-agent `explorer` (via `mcp__provider-agents__spawn_agent`, profile `explorer`) com um prompt que force o uso da busca semble num repo real, por exemplo:
```
Use a ferramenta MCP semble (mcp__semble__search) para localizar onde a função spawnAgent é definida no repo /home/samuel/Documentos/pessoal/provider-agents. Responda com file:line e diga explicitamente qual ferramenta usou.
```
Expected: o explorer retorna um `file:line` plausível (ex.: em `src/`) E declara ter usado a ferramenta semble. Se ele disser que a ferramenta não está disponível, o wiring falhou → revisar `spawner.ts`/caminho antes de seguir. **Não avançar para a Task 4 enquanto este passo não passar.**

---

### Task 4: Remover o semble do escopo global (só após Task 3 verde)

**Files:**
- Modify: `~/.claude.json` (via CLI `claude mcp remove`, NÃO à mão)

**Interfaces:**
- Consumes: confirmação de que o explorer acessa semble (Task 3, Step 4).

- [ ] **Step 1: Remover o semble do escopo User**

Run: `claude mcp remove semble`
Expected: mensagem de remoção bem-sucedida (ex.: `Removed MCP server semble`).

- [ ] **Step 2: Confirmar que saiu do global**

Run: `claude mcp get semble 2>&1 | head -3`
Expected: indica que o servidor não existe mais no escopo User (ex.: `No MCP server found` / não listado). Complementar: `claude mcp list | grep -c semble` → `0`.

- [ ] **Step 3: Confirmar que novas sessões NÃO sobem semble**

Run: `claude -p "responda apenas: ok" >/dev/null 2>&1; sleep 2; echo "sembles agora: $(pgrep -fc 'bin/semble' || echo 0)"`
Expected: a contagem não cresce por causa de uma sessão nova (a sessão `-p` sobe sem semble e encerra). Comparar com a base anotada na Task 2.

---

### Task 5: Limpar os processos semble órfãos

**Files:**
- (nenhum — limpeza de runtime)

**Interfaces:**
- Consumes: semble já removido do global (Task 4).

- [ ] **Step 1: Listar instâncias vivas antes da limpeza**

Run: `ps -o pid,etime,rss,cmd -C python | grep "bin/semble" | wc -l; echo "--- detalhe ---"; for p in $(pgrep -f "bin/semble"); do printf "PID %s up %s rss %sKB\n" "$p" "$(ps -o etime= -p $p|tr -d ' ')" "$(ps -o rss= -p $p|tr -d ' ')"; done`
Expected: lista os ~19 processos (número exato pode variar).

- [ ] **Step 2: Matar todos os semble órfãos (SIGTERM)**

Como o semble saiu do global e o explorer sobe o seu sob demanda, é seguro encerrar todos os atuais. Sessões interativas abertas apenas perdem o semble (já depreciado do escopo delas).

Run: `pkill -TERM -f "bin/semble"; sleep 3; echo "restantes: $(pgrep -fc 'bin/semble' || echo 0)"`
Expected: `restantes: 0` (ou poucos, caso uma chamada de explorer esteja em curso). Se algum resistir ao TERM por estar travado (`stat Tl`), repetir com `pkill -KILL -f "bin/semble"`.

- [ ] **Step 3: Conferir alívio de swap/RAM**

Run: `free -h`
Expected: swap em uso menor que antes (os ~3,2 GB de sembles frios liberados). Não precisa zerar — só confirmar a queda.

---

## Rollback (se algo der errado em qualquer task)

Reverter é restaurar o estado de origem:

1. **Re-registrar semble no global:**
   ```bash
   claude mcp add-json semble '{"type":"stdio","command":"uvx","args":["--from","semble[mcp]","semble"],"env":{}}' -s user
   ```
   Verificar: `claude mcp get semble` → `Scope: User config`.
2. **Limpar o explorer:** no `profiles.yaml`, voltar `mcp_config:` para `[]`.
   Verificar: `python3 -c "import yaml; print(yaml.safe_load(open('/home/samuel/.config/provider-agents/profiles.yaml'))['profiles']['explorer']['mcp_config'])"` → `[]`.
3. **(Opcional)** remover `~/.config/provider-agents/semble.mcp.json`.

---

## Self-Review

**Spec coverage:**
- "Desativar semble no Claude (global)" → Task 4. ✓
- "Deixar semble registrado só no explorer" → Tasks 1–3. ✓
- "Garantir que o resultado é bom" (não quebrar busca) → ordem Task 3-antes-de-4 + verificação end-to-end (Task 3 Step 4). ✓
- Limpeza dos órfãos discutida com o usuário → Task 5. ✓
- Reversibilidade → seção Rollback. ✓

**Placeholder scan:** sem TBD/TODO; todos os comandos e blocos JSON/YAML estão completos e verbatim. ✓

**Type/consistency:** caminho `~/.config/provider-agents/semble.mcp.json` idêntico em Tasks 1, 2, 3 e Rollback; bloco semble idêntico (Global Constraints, Task 1, Rollback). ✓

**Risco aberto conhecido:** não foi verificado se o `semble` compartilha índice em disco ou reindexar por processo (impacta o ganho de CPU, não a corretude). Registrado como observação, não bloqueia.
