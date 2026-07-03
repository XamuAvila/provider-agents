# Decisão: Swarm Blackboard (Fase 3) — ADIADO

**Data:** 2026-07-03
**Status:** Adiado (não rejeitado). Brainstorm concluído até a escolha de abordagem.

## Contexto

Roadmap discutido para evoluir o provider-agents:

1. **Fase 1** — unificar config no repo (`config/profiles.yaml` + creds em `~/.config/provider-agents/creds/`).
2. **Fase 2** — registrar `archon_run` como tool MCP (task 12 pendente do plano `2026-06-23-coordinator-sakana.md`).
3. **Fase 3** — blackboard sessions (`swarm_start`/`swarm_round`/`swarm_read`/`swarm_finish`): comunicação inter-agente via diretório de sessão compartilhado, rounds dirigidos pelo Claude.
4. **Fase 4** — coordinator TRINITY + policy learning (types já existem em `src/archon/types.ts:23-55`).

## Decisões do brainstorm da Fase 3 (preservadas para retomada)

| Questão | Decisão |
|---|---|
| Caso de uso | Ambos: investigação multi-perspectiva E geração (extensão do Archon) |
| Orquestração | Granular — Claude dirige round a round (não monolítica) |
| Escrita no blackboard | Mediada — orquestrador parseia stdout; agentes NÃO ganham Write (settings negam Write/Edit; CLI free são chat-only) |
| Formato | Markdown com frontmatter (agent, round, type, refs) + `state.json` índice |
| Fechamento | Auto por tipo: `unitTestRank` do Archon para código; Claude sintetiza para investigação |
| Abordagem | A — módulo `src/swarm/` novo, tools stateless, estado 100% em disco; **importa** layers do Archon, nunca copia |

## Por que adiado

- Archon ainda não entrega no dia a dia — `archon_run` nunca foi registrado como tool MCP (`src/index.ts` não tem tools archon). Fase 2 destrava isso com esforço mínimo.
- O grosso do valor do swarm já é alcançável sem código novo: fan-out paralelo de `spawn_agent` + rounds manuais (Claude injeta outputs do round N no prompt do round N+1).
- Guardrail do plano coordinator-sakana: "multi-agent is NOT always better than a single strong agent at equal budget" — tooling deve ser eval-gated, e não há evidência de demanda ainda.
- Risco evitado: drift/duplicação entre swarm e archon na seleção de candidatos.

## Critério de retomada

Construir as tools da Fase 3 quando o padrão manual de rounds (fan-out + reinject) se mostrar **frequente e caro em tokens de orquestração** no uso real — aí as decisões acima viram spec via `superpowers:writing-plans`.
