---
name: design-patterns-go
description: Catálogo dos 22 padrões de projeto GoF em Go (Golang) com framework de decisão arquitetural. Use SEMPRE que o usuário discutir design de código em Go, mencionar qualquer pattern (Strategy, Observer, Factory, Builder, Adapter, Decorator, Proxy, Singleton, Mediator, State, Visitor, Command, etc.), pedir refactoring de código Go, descrever um problema de acoplamento/extensibilidade/duplicação, debater alternativas arquiteturais (ex: "devo usar interface aqui?", "como desacoplar X de Y?", "qual a melhor forma de modelar Z?"), ou apresentar trechos de código Go para revisão. Use também quando o usuário trouxer um RFC, ADR ou discussão de design em Go pedindo opinião sobre estrutura. Esta skill avalia o caso descrito e recomenda o(s) pattern(s) mais adequado(s) com justificativa, trade-offs e exemplo idiomático.
---

# Design Patterns em Go — Skill de Avaliação Arquitetural

Esta skill faz duas coisas:

1. **Avalia um problema arquitetural** descrito pelo usuário e recomenda o(s) pattern(s) GoF mais adequado(s), com justificativa e trade-offs.
2. **Fornece exemplos idiomáticos em Go** carregando o arquivo de referência do pattern escolhido.

Os exemplos completos estão em `references/{categoria}/{pattern}.md` — **não os carregue todos**. Carregue apenas o(s) que você for usar na resposta, via `view`.

---

## Como o Go é diferente (idiomas que você DEVE respeitar)

Go não tem classes, herança nem generics ricos como Java/C#. Isso muda como vários patterns GoF se materializam. Antes de recomendar um pattern, verifique se a versão Go faz sentido:

- **Sem herança → composição via embedding.** Patterns que dependem de herança em livros clássicos (Template Method, Decorator) usam embedding de structs e interfaces em Go.
- **Interfaces implícitas.** Em Go, qualquer tipo que implementa os métodos de uma interface a satisfaz automaticamente. Isso torna **Strategy, Adapter, Observer, State** muito mais leves — frequentemente basta uma interface bem definida.
- **Sem construtores → funções `New...()`.** Factory Method e Abstract Factory normalmente são apenas funções `NewFoo() Foo` ou `NewFooBar() (Foo, error)`.
- **Goroutines + channels mudam Observer e Mediator.** Em vez de listas de listeners, considere channels e `select`. Avalie qual abordagem cabe no contexto.
- **Singleton é frequentemente um anti-pattern em Go.** Use `sync.Once` se realmente precisar, mas prefira injeção via parâmetro (mais testável). Se o usuário pedir Singleton, **alerte sobre a alternativa** antes de mostrar o código.
- **Erros são valores (`error`).** Patterns que envolvem exceptions em outras linguagens (Chain of Responsibility, Command com undo) em Go usam retornos de erro explícitos.
- **`interface{}` / `any` é último recurso.** Se um pattern só funciona com `any`, pense duas vezes — talvez seja over-engineering.

---

## Decision Framework — Como avaliar um caso

Quando o usuário descrever um problema (RFC, trecho de código, dor de manutenção, decisão de design), siga este processo **antes** de sugerir um pattern. **Não** comece dando o nome de um pattern; primeiro entenda o problema.

### Passo 1 — Classifique a dor

Identifique qual sintoma melhor descreve o problema:

| Sintoma | Categoria provável |
|---|---|
| "Quero trocar comportamento em runtime" / "vários algoritmos para a mesma coisa" | **Comportamental** (Strategy, State, Command) |
| "Cada `if/switch` por tipo está virando uma bagunça" | **Comportamental** (Strategy, State, Visitor) ou **Criacional** (Factory) |
| "Estou criando objetos complexos com muitos parâmetros opcionais" | **Criacional** (Builder, Functional Options) |
| "Tenho duas APIs incompatíveis que precisam conversar" | **Estrutural** (Adapter, Facade) |
| "Quero adicionar comportamento sem mudar o tipo original" | **Estrutural** (Decorator, Proxy) |
| "Preciso notificar N partes quando algo muda" | **Comportamental** (Observer, Mediator) ou **channels** |
| "Tenho uma árvore/hierarquia para percorrer uniformemente" | **Estrutural** (Composite) ou **Comportamental** (Visitor) |
| "Preciso controlar acesso, lazy load, cache, ou logging em chamadas" | **Estrutural** (Proxy, Decorator) |
| "Quero desacoplar quem dispara de quem executa uma ação" | **Comportamental** (Command, Mediator) |
| "Tenho que orquestrar uma sequência de passos com variações" | **Comportamental** (Template Method, Chain of Responsibility) |
| "Vou criar muitos objetos parecidos e a memória vai explodir" | **Estrutural** (Flyweight) |
| "Quero produzir famílias de objetos relacionados" | **Criacional** (Abstract Factory) |
| "Preciso salvar/restaurar estado de um objeto sem expor internals" | **Comportamental** (Memento) |
| "Quero iterar sobre algo sem expor a estrutura interna" | **Comportamental** (Iterator — em Go, geralmente channels ou range sobre slice) |

### Passo 2 — Aplique os filtros de "não use pattern aqui"

Antes de recomendar, **rejeite** o pattern se algum destes for verdade:

- **YAGNI:** O problema é hipotético. Só há uma implementação hoje e nenhuma evidência de que outra virá. → Recomende a solução simples, mencione o pattern como "se um dia precisar de N variações, considere Strategy".
- **A linguagem já resolve:** A feature do Go (channels, interfaces implícitas, embedding, functional options, `io.Reader`) já cobre o caso de forma idiomática. → Mostre o jeito Go primeiro.
- **Custo de indireção > benefício:** O pattern adiciona 3+ tipos novos para resolver algo que um `if` ou uma função resolveria. → Não use.
- **Equipe não conhece:** Se for um pattern obscuro num codebase onde a equipe é majoritariamente júnior, prefira a opção mais clara mesmo que menos elegante. (No contexto da BlisAI, considere quem vai dar manutenção.)

### Passo 3 — Considere alternativas Go-idiomáticas

Para cada pattern clássico, há frequentemente uma versão "Go-way" mais simples. **Sempre mencione a alternativa idiomática** ao recomendar:

| Pattern clássico | Alternativa idiomática Go a considerar primeiro |
|---|---|
| Builder | **Functional Options** (`func(opts *Options)`) — quase sempre melhor em Go |
| Singleton | `sync.Once` + variável de pacote, ou simplesmente injeção via parâmetro |
| Observer | **channels + goroutines** (`chan Event`), ou um slice de callbacks |
| Strategy | Interface + funções de primeira classe (uma interface de 1 método ≈ uma func type) |
| Iterator | `range` sobre slice/map/channel; ou função geradora retornando channel |
| Template Method | Embedding de struct + métodos sobreescritos via interface |
| Command | Função de primeira classe (`type Command func() error`) |
| Decorator | Wrapping de interface (`type loggingHandler struct { next http.Handler }`) — muito comum em middleware HTTP |

### Passo 4 — Estruture sua resposta

Quando for responder, siga este formato:

1. **Reformulação do problema** (1–2 frases) — mostra que você entendeu a dor antes de prescrever.
2. **Pattern recomendado** (com nome e categoria) ou "nenhum pattern, faça assim" se YAGNI.
3. **Por que esse e não os outros candidatos** — cite 1–2 alternativas e por que foram descartadas.
4. **Versão Go idiomática** — código compilável, curto, comentado em PT-BR.
5. **Trade-offs** — o que você ganha, o que você paga (complexidade, indireção, testabilidade).
6. **Quando NÃO usar / red flags futuros** — sinais de que essa decisão envelheceu mal.
7. **Link para o exemplo completo** do refactoring.guru (presente no `.md` do pattern em `references/`).

---

## Catálogo dos 22 patterns

Ao precisar de um exemplo completo, **leia o arquivo correspondente** com `view`:

### Criacionais — `references/creational/`

| Pattern | Quando usar (resumo) | Arquivo |
|---|---|---|
| **Abstract Factory** | Criar famílias de objetos relacionados sem acoplar ao tipo concreto | `creational/abstract-factory.md` |
| **Builder** | Construir objetos complexos passo a passo. **Em Go, prefira Functional Options** na maioria dos casos. | `creational/builder.md` |
| **Factory Method** | Delegar a criação de um objeto para subtipos/funções especializadas. Em Go, geralmente é só uma `New...()`. | `creational/factory-method.md` |
| **Prototype** | Clonar objetos existentes em vez de recriar do zero. Pouco comum em Go. | `creational/prototype.md` |
| **Singleton** | Garantir uma única instância. **Em Go, normalmente é anti-pattern** — alerte o usuário e ofereça `sync.Once` ou injeção. | `creational/singleton.md` |

### Estruturais — `references/structural/`

| Pattern | Quando usar (resumo) | Arquivo |
|---|---|---|
| **Adapter** | Ligar duas APIs incompatíveis sem mudar nenhuma delas | `structural/adapter.md` |
| **Bridge** | Separar uma abstração da sua implementação para variarem independentemente | `structural/bridge.md` |
| **Composite** | Tratar objetos individuais e composições uniformemente (árvores) | `structural/composite.md` |
| **Decorator** | Adicionar comportamento a um objeto sem alterar sua interface. **Muito comum em middleware HTTP em Go.** | `structural/decorator.md` |
| **Facade** | Esconder um subsistema complexo atrás de uma interface simples | `structural/facade.md` |
| **Flyweight** | Compartilhar estado entre muitos objetos pequenos para economizar memória | `structural/flyweight.md` |
| **Proxy** | Controlar acesso a um objeto (lazy, cache, logging, autorização, remote) | `structural/proxy.md` |

### Comportamentais — `references/behavioral/`

| Pattern | Quando usar (resumo) | Arquivo |
|---|---|---|
| **Chain of Responsibility** | Passar uma requisição por uma cadeia de handlers até alguém tratar. **Comum em middleware**. | `behavioral/chain-of-responsibility.md` |
| **Command** | Encapsular uma ação como objeto (undo, fila, log, agendamento). Em Go, frequentemente uma `func()`. | `behavioral/command.md` |
| **Iterator** | Percorrer uma coleção sem expor sua estrutura. Em Go, normalmente `range` ou channel. | `behavioral/iterator.md` |
| **Mediator** | Centralizar comunicação entre componentes que não devem se conhecer | `behavioral/mediator.md` |
| **Memento** | Salvar/restaurar estado interno sem violar encapsulamento | `behavioral/memento.md` |
| **Observer** | Notificar N assinantes quando algo muda. Em Go, considere **channels**. | `behavioral/observer.md` |
| **State** | Trocar comportamento conforme um estado interno (FSM) | `behavioral/state.md` |
| **Strategy** | Trocar algoritmo em runtime via interface. **O mais comum em Go.** | `behavioral/strategy.md` |
| **Template Method** | Definir esqueleto de um algoritmo deixando passos para "subtipos". Em Go, via embedding + interface. | `behavioral/template-method.md` |
| **Visitor** | Adicionar operações a uma hierarquia de tipos sem modificá-la | `behavioral/visitor.md` |

---

## Heurísticas rápidas (para casos comuns)

- **"Tenho um `switch` gigante por tipo"** → Strategy ou State (depende se o tipo muda durante a vida do objeto: muda → State; é fixo na criação → Strategy).
- **"Estou montando uma cadeia de validações/transformações"** → Chain of Responsibility ou simplesmente uma slice de funções.
- **"Quero logar/medir/cachear todas as chamadas a um serviço"** → Decorator ou Proxy (Decorator se você empilha várias camadas, Proxy se há uma única responsabilidade clara como auth ou cache).
- **"Quero adicionar uma operação nova a vários tipos"** → Visitor (mas pense se um type switch mais simples não resolve).
- **"Construtor com 8 parâmetros, metade opcional"** → **Functional Options**, não Builder.
- **"Eventos de domínio que vários consumidores ouvem"** → Observer com channels, ou um Event Bus (que é Observer + Mediator).
- **"FSM de máquina de estados de pedido/reserva/checkout"** → State pattern. Muito relevante para fluxos de booking/reserva.

---

## Como usar esta skill numa resposta

1. Leia o problema do usuário com cuidado.
2. Aplique o **Decision Framework** (Passos 1–4) mentalmente.
3. Escolha o pattern (ou diga "não use pattern aqui").
4. **Carregue o arquivo de referência** com `view` em `references/{categoria}/{slug}.md` para garantir que o exemplo Go que você vai mostrar é o correto.
5. Estruture a resposta com os 7 itens do Passo 4.
6. Sempre inclua o link do refactoring.guru ao final (já está no header de cada arquivo de referência).

**Não invente exemplos do zero** se há um arquivo de referência disponível — use o exemplo do refactoring.guru como base e adapte ao contexto do usuário (ex: mude nomes de cache para nomes de hotel/voo/agente se for contexto BlisAI).
