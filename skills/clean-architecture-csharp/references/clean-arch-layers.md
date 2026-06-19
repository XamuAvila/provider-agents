# Clean Architecture: Layers, Boundaries & Components

Core architectural concepts from Clean Architecture chapters 12-28.

## Table of Contents
1. [The Clean Architecture Model](#the-clean-architecture-model)
2. [The Dependency Rule](#the-dependency-rule)
3. [Layer Details](#layer-details)
4. [Component Principles](#component-principles)
5. [Boundaries](#boundaries)
6. [Key Architectural Patterns](#key-architectural-patterns)

---

## The Clean Architecture Model

Four concentric circles, from innermost (most protected) to outermost (most volatile):

1. **Entities** — Enterprise-wide business rules, domain objects
2. **Use Cases** — Application-specific business rules, orchestrate entities
3. **Interface Adapters** — Convert data between use case format and external format (Controllers, Presenters, Gateways)
4. **Frameworks & Drivers** — DB, Web framework, UI, external services — the details

These aren't rigid — you may need more circles. But the **Dependency Rule** always applies.

### Characteristics of a Clean Architecture

- **Independent of frameworks** — frameworks are tools, not constraints
- **Testable** — business rules testable without UI, DB, web server, or any external element
- **Independent of UI** — UI can change without changing business rules
- **Independent of database** — swap Oracle for Mongo without touching business rules
- **Independent of external agencies** — business rules know nothing about the outside world

---

## The Dependency Rule

> Source code dependencies must point only inward, toward higher-level policies.

This is the ONE rule that makes everything work:

- Nothing in an inner circle knows about anything in an outer circle
- No name declared in an outer circle may be mentioned by code in an inner circle
- Data formats from outer circles must not be used in inner circles (especially framework-generated formats)

### Crossing Boundaries

When the flow of control goes outward (e.g., use case needs to call a presenter), use **Dependency Inversion**:

1. Inner circle defines an **output port** (interface)
2. Outer circle implements that interface
3. Flow of control goes outward, but dependency points inward

```
Flow of control: Controller → Use Case → Presenter
Dependencies:    Controller → Use Case ← Presenter
                 (Both Controller and Presenter depend on Use Case layer)
```

### Data Crossing Boundaries

Data that crosses boundaries should be:
- Simple data structures (DTOs, records)
- NOT Entity objects (that would leak inner circle outward)
- NOT database row structures (that would leak outer circle inward)
- In the format most convenient for the INNER circle

---

## Layer Details

### Entities (Domain Layer)

Contain enterprise-wide critical business rules. These are the rules that would exist even if the system were manual (no software).

- **Most stable** layer — changes only when fundamental business rules change
- Can be objects with methods OR data structures with functions
- NO framework dependencies, NO database annotations, NO serialization attributes
- Can be used across multiple applications in the enterprise

```
Examples: Order (with business validation), Money (value object),
          PricingPolicy, ShippingCalculator (domain service)
```

### Use Cases (Application Layer)

Application-specific business rules. Orchestrate the flow of data to and from entities.

- Define **input ports** (interfaces that controllers call)
- Define **output ports** (interfaces that presenters/gateways implement)
- Contain NO UI logic, NO persistence logic
- Changes when application behavior changes (NOT when framework changes)

```
Examples: CreateOrderInteractor, CancelOrderInteractor,
          GenerateInvoiceInteractor
```

### Interface Adapters

Convert data between the format used by use cases/entities and the format used by external agencies.

- **Controllers** — convert HTTP request → Use Case input DTO
- **Presenters** — convert Use Case output DTO → ViewModel for the view
- **Gateways** — convert Use Case data access interface → SQL/NoSQL queries
- **Mappers** — convert external data formats to/from domain formats

```
Examples: OrderController, OrderPresenter, SqlOrderRepository,
          StripePaymentAdapter, OrderMapper
```

### Frameworks & Drivers

The outermost layer. Glue code that connects to frameworks and tools.

- Web framework configuration (ASP.NET middleware, routing)
- Database drivers and ORM configuration
- External service SDKs
- UI rendering engines

```
Examples: Program.cs, DbContext configuration, Startup middleware,
          Swagger setup, Docker/deployment configuration
```

---

## Component Principles

### Cohesion Principles (what goes together in a component)

**REP — Reuse/Release Equivalence Principle**
Classes and modules that form a component should be releasable together. If they can't be versioned and released as a unit, they don't belong in the same component.

**CCP — Common Closure Principle** (SRP for components)
Group together classes that change for the same reason at the same time. A change in requirements should affect the fewest components possible — ideally just one.

**CRP — Common Reuse Principle** (ISP for components)
Don't force users of a component to depend on things they don't need. If you only use one class from a component, you still depend on all of it. Classes that aren't tightly bound shouldn't be in the same component.

### Tension Triangle

These three principles exist in tension:
- **REP + CCP** → Group for releasability and common change (makes components larger)
- **CCP + CRP** → Group for common change, exclude what's unrelated (more focused)
- **REP + CRP** → Group for reuse, exclude what reusers don't need (makes components smaller)

Early in a project, favor **CCP** (ease of development). As the project matures and others reuse your components, shift toward **REP** and **CRP**.

### Coupling Principles (relationships between components)

**ADP — Acyclic Dependencies Principle**
No cycles in the component dependency graph. If A → B → C → A exists, changes cascade unpredictably. Break cycles with DIP (introduce an interface) or create a new component that both depend on.

**SDP — Stable Dependencies Principle**
Depend in the direction of stability. A component that many others depend on (high fan-in) is hard to change — it should be stable. A volatile component should only depend on things more stable than itself.

**SAP — Stable Abstractions Principle**
A component should be as abstract as it is stable. Stable components (many dependents) should be abstract (contain interfaces). Volatile components should be concrete (contain implementations).

**The Main Sequence**: Plot components on I (instability) vs A (abstractness). Components should fall near the line from (0,1) to (1,0). Components at (0,0) are the "Zone of Pain" (stable + concrete = hard to change). Components at (1,1) are the "Zone of Uselessness" (unstable + abstract = unused abstractions).

---

## Boundaries

### What Is a Boundary?

An architectural boundary is a line that separates components with different rates and reasons for change. Boundaries are drawn where the Dependency Rule requires them.

### Types of Boundaries

**Source-level** (Monolith)
- Separation by namespaces, interfaces, and dependency injection
- All components in a single deployment unit
- Lowest cost, but discipline required to maintain boundaries

**Deployment-level** (Components/DLLs)
- Separate assemblies (NuGet packages, DLLs)
- Dependencies enforced by the build system
- Moderate cost, stronger boundary enforcement

**Service-level** (Microservices)
- Separate processes, communicate over network
- Strongest isolation, highest cost
- Communication latency, operational complexity

### Partial Boundaries

Full architectural boundaries are expensive. When you're not sure a boundary is needed:

1. **Skip the Last Step** — Create the interfaces and split the code, but keep them in the same component. Ready to split later.
2. **One-Dimensional Boundary** — Use the Strategy pattern instead of full reciprocal boundaries (simpler but less protected).
3. **Facade** — A single class that delegates to inner classes. Weakest boundary, but zero cost and easy to upgrade.

### When to Add Boundaries

- When you see that a change in one area consistently causes changes in another
- When two teams need to work independently
- When you want to swap an implementation (database, UI, external service)
- When you need to test business rules in isolation

Don't over-architect. Start with Facades and partial boundaries. Upgrade when the cost of NOT having the boundary exceeds the cost of adding it.

---

## Key Architectural Patterns

### The Humble Object Pattern

Split behavior at an architectural boundary into two modules:
- **Humble Object** — hard to test, contains framework coupling (e.g., View, database connector)
- **Testable Object** — easy to test, contains the logic (e.g., Presenter, Gateway interface implementation)

The Presenter prepares data for the View by formatting everything into strings, booleans, and simple structures (ViewModel). The View just moves data from ViewModel to screen — almost no logic to test.

### Screaming Architecture

Your architecture should SCREAM what the system does, not what framework it uses. Looking at the top-level directory structure, you should see "Health Care System" or "Accounting System" — not "Rails", "Spring", or "ASP.NET".

### The Main Component

The `Main` component (the entry point — `Program.cs` in C#) is:
- The dirtiest component — it knows about ALL concrete implementations
- The outermost component — the "Ultimate Detail"
- Think of it as a plugin to the application — it loads everything, wires it up, then hands control to the high-level policy

### Services Aren't Architecture

Just because you use microservices doesn't mean you have clean architecture. A microservice can have a monolithic, tightly-coupled internal structure. Architecture is about dependency direction, not deployment topology.

Architectural boundaries and service boundaries are different things. A well-designed monolith with clean boundaries can be split into services later. A poorly designed microservice system can be just as coupled as a big ball of mud.
