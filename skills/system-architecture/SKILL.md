---
name: system-architecture
description: >
  Guia completo de System Architecture com 11 chapters cobrindo arquitetura de sistemas,
  API design patterns, diagramas de arquitetura, dependency mapping, multi-cloud, technical debt,
  platform engineering, application architecture, software design documents, web application
  architecture e legacy modernization. Use esta skill sempre que o usuário perguntar sobre
  arquitetura de sistemas, design de APIs, diagramas de arquitetura, dívida técnica,
  platform engineering, documentos de design de software, modernização de sistemas legados,
  multi-cloud, microservices vs monolith, event-driven architecture, serverless, ou qualquer
  tópico relacionado a decisões arquiteturais de software. Também use quando o usuário pedir
  templates de documentos de design, quiser criar diagramas de arquitetura, ou precisar de
  orientação sobre melhores práticas de arquitetura. Fonte: multiplayer.app/system-architecture.
---

# System Architecture — Skill de Referência

Skill baseada no guia "System Architecture: Tutorial & Best Practices" da Multiplayer,
com 11 chapters cobrindo desde fundamentos de arquitetura até modernização de sistemas legados.

## Quando esta skill é acionada

- Perguntas sobre arquitetura de sistemas, componentes, tipos (monolith, microservices, etc.)
- API design patterns (caching, pagination, rate limiting, pub/sub, access control)
- Criação de diagramas de arquitetura (system, application, sequence, data flow)
- Dependency mapping e análise de dependências entre serviços
- Estratégias multi-cloud e decisões de infraestrutura
- Technical debt: identificação, priorização e resolução
- Platform engineering e internal developer platforms (IDPs)
- Templates e boas práticas para software design documents
- Web application architecture (SPA, SSR, MPA, PWA, JAMstack)
- Legacy modernization (strangler fig, replatforming, refactoring)

## Estrutura dos arquivos

Cada chapter é um arquivo separado. Leia APENAS o(s) arquivo(s) relevante(s).

```
chapters/
├── chapter-01-system-architecture.md
├── chapter-02-api-design-patterns.md
├── chapter-03-system-architecture-diagram.md
├── chapter-04-application-dependency-mapping.md
├── chapter-05-multi-cloud-architecture.md
├── chapter-06-technical-debt-examples.md
├── chapter-07-platform-engineering.md
├── chapter-08-application-architecture-diagram.md
├── chapter-09-software-design-document-template.md
├── chapter-10-web-application-architecture.md
└── chapter-11-legacy-application-modernization.md
```

## Índice de chapters e roteamento

Use esta tabela para decidir qual chapter carregar baseado na pergunta do usuário:

| # | Chapter | Arquivo | Quando carregar |
|---|---------|---------|-----------------|
| 1 | System Architecture | `chapter-01-system-architecture.md` | Fundamentos de arquitetura, tipos (monolith, microservices, event-driven, serverless, edge, P2P), componentes, best practices gerais |
| 2 | API Design Patterns | `chapter-02-api-design-patterns.md` | Design de APIs, REST, caching, pagination, rate limiting, pub/sub, access control, versionamento de API |
| 3 | System Architecture Diagram | `chapter-03-system-architecture-diagram.md` | Como criar diagramas de arquitetura de sistema, ferramentas, notações, tipos de diagramas |
| 4 | Application Dependency Mapping | `chapter-04-application-dependency-mapping.md` | Mapeamento de dependências entre serviços, análise de impacto, service mesh, observabilidade |
| 5 | Multi Cloud Architecture | `chapter-05-multi-cloud-architecture.md` | Estratégias multi-cloud, vendor lock-in, portabilidade, decisões AWS vs GCP vs Azure |
| 6 | Technical Debt Examples | `chapter-06-technical-debt-examples.md` | Identificação de dívida técnica, priorização, exemplos práticos, estratégias de resolução |
| 7 | Platform Engineering | `chapter-07-platform-engineering.md` | Internal developer platforms, DevEx, self-service, golden paths, platform teams |
| 8 | Application Architecture Diagram | `chapter-08-application-architecture-diagram.md` | Diagramas de arquitetura de aplicação (diferente do system diagram), componentes internos |
| 9 | Software Design Document | `chapter-09-software-design-document-template.md` | Templates de design docs, como escrever RFCs/design docs, exemplos para microservices/monolith/serverless |
| 10 | Web Application Architecture | `chapter-10-web-application-architecture.md` | SPA vs SSR vs MPA, PWA, JAMstack, frontend architecture, rendering strategies |
| 11 | Legacy Modernization | `chapter-11-legacy-application-modernization.md` | Strangler fig pattern, replatforming, refactoring, migração de sistemas legados |

## Fluxo de resposta

### 1. Identificar o(s) chapter(s) relevante(s)

Use a tabela acima para mapear a pergunta do usuário ao chapter correto.
Se a pergunta cruza múltiplos chapters, carregue no máximo 2-3 dos mais relevantes.

```
view chapters/chapter-XX-slug.md
```

### 2. Estrutura da resposta

Ao responder sobre arquitetura, siga esta estrutura:

1. **Contexto** — Explique brevemente o conceito ou desafio arquitetural
2. **Opções/Abordagens** — Liste as alternativas com trade-offs de cada uma
3. **Diagrama** — Gere um diagrama Mermaid quando relevante (flowchart, sequence, C4)
4. **Recomendação** — Se o usuário deu contexto sobre seu projeto, recomende a abordagem mais adequada
5. **Referência** — Link para o chapter original no multiplayer.app

### 3. Diagramas

Sempre que a resposta envolver arquitetura, gere um diagrama Mermaid. Exemplos de tipos:

- **System Architecture**: flowchart TD com componentes principais
- **Sequence**: sequenceDiagram para fluxos de comunicação
- **Data Flow**: flowchart LR para pipelines de dados
- **C4 Context**: flowchart mostrando actors e systems
- **Dependency Map**: graph com dependências entre serviços

### 4. Contextualização

Se o usuário forneceu contexto sobre seu stack (ex: .NET, Python, GCP, multi-agent),
adapte exemplos e recomendações para esse contexto. Não dê respostas genéricas quando
tiver informação para personalizar.

## Guia de decisão rápida

| Pergunta do usuário | Chapter(s) | Ação |
|---------------------|-----------|------|
| "Microservices vs monolith" | 1 | Comparar tipos com trade-offs |
| "Como desenhar minha API" | 2 | Mostrar patterns + exemplos |
| "Preciso de um diagrama do meu sistema" | 3, 8 | Guiar criação + gerar Mermaid |
| "Quais serviços dependem de quais" | 4 | Dependency mapping |
| "Devo usar AWS ou GCP ou ambos" | 5 | Multi-cloud trade-offs |
| "Temos muita dívida técnica" | 6 | Framework de priorização |
| "Quero criar uma plataforma interna" | 7 | Platform engineering playbook |
| "Preciso escrever um design doc" | 9 | Template + exemplos |
| "SPA ou SSR para meu frontend" | 10 | Comparativo de abordagens |
| "Como migrar nosso sistema legado" | 11 | Estratégias de modernização |

## Referência

Todos os chapters são baseados no guia da Multiplayer:
https://www.multiplayer.app/system-architecture/
