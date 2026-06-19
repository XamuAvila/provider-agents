# SOLID Principles at the Architectural Level

The SOLID principles aren't just about classes — they scale up to components, layers, and system architecture. This reference covers how each principle applies at the architectural level, based on Clean Architecture chapters 7-11.

## SRP — Single Responsibility Principle

**At class level**: A module should be responsible for one, and only one, actor.

**At component level**: This becomes the **Common Closure Principle (CCP)** — group together classes that change for the same reason and at the same time. Separate classes that change for different reasons.

**At architectural level**: This becomes the **Axis of Change** that creates architectural boundaries.

### The Key Insight

SRP is NOT "a function should do one thing" — that's a different, lower-level principle. SRP is about *actors* (groups of users/stakeholders who request changes). A module coupled to multiple actors will have changes from one actor breaking things for another.

### Classic Example (C#)

```csharp
// VIOLATION: Three actors depend on one class
public class Employee
{
    public decimal CalculatePay() { ... }    // CFO's team (Accounting)
    public string ReportHours() { ... }      // COO's team (HR)
    public void Save() { ... }               // CTO's team (DBAs)
}

// SOLUTION: Separate by actor
public class PayCalculator
{
    public decimal CalculatePay(EmployeeData data) { ... }
}

public class HourReporter
{
    public string ReportHours(EmployeeData data) { ... }
}

public class EmployeeRepository
{
    public void Save(EmployeeData data) { ... }
}

// Optional: Facade if callers need a single entry point
public class EmployeeFacade
{
    private readonly PayCalculator _payCalc;
    private readonly HourReporter _hourReporter;
    private readonly EmployeeRepository _repo;
    // delegates to each
}
```

### Architectural Impact

When SRP is violated at the architectural level, you get **merge conflicts between teams**, **unintended side effects across domains**, and **deployment coupling** — changing the payment logic forces redeploying the HR module.

---

## OCP — Open/Closed Principle

**Core idea**: Software artifacts should be open for extension but closed for modification.

**At architectural level**: Organize components in a **dependency hierarchy** where higher-level components are protected from changes in lower-level components.

### The Protection Hierarchy

The most important components (business rules / Interactor) are the most protected. Changes in lower-level components (Views, Database, Controllers) don't affect them.

```
Most Protected                              Least Protected
    Entities → Use Cases → Controllers → Views
    Entities → Use Cases → Presenters → Views
    Entities → Use Cases → Gateways → Database
```

All dependency arrows point LEFT (inward). Changes on the right don't ripple left.

### How It Works

- **Entities** are protected from everything
- **Use Cases** are protected from UI, DB, and framework changes
- **Controllers/Presenters** are protected from View changes
- **Views** are the least protected (and most volatile — that's OK)

This is achieved through **dependency inversion**: interfaces defined in the inner layer, implemented in the outer layer.

### C# Application

```csharp
// Inner layer defines the interface
namespace MyApp.Application.Interfaces
{
    public interface IOrderRepository
    {
        Task<Order> GetByIdAsync(int id);
        Task SaveAsync(Order order);
    }
}

// Outer layer implements it — can change DB without touching Application
namespace MyApp.Infrastructure.Persistence
{
    public class SqlOrderRepository : IOrderRepository
    {
        // Can swap to MongoDB, DynamoDB, etc. without changing Use Cases
    }
}
```

---

## LSP — Liskov Substitution Principle

**Core idea**: Subtypes must be substitutable for their base types without altering the correctness of the program.

**At architectural level**: All implementations of an interface must behave consistently. A violation at this level contaminates the entire architecture with special cases.

### The Taxi Dispatch Example

If all taxi companies agree on a REST interface (`/pickupAddress/{addr}/pickupTime/{time}/destination/{dest}`) but one company uses `dest` instead of `destination`, you get:

```csharp
// LSP violation forces special cases into the architecture
if (driver.DispatchUri.Host.Contains("acme.com"))
{
    // Special dispatch format for Acme
    uri = BuildAcmeDispatch(driver, pickup);
}
else
{
    // Standard format for everyone else
    uri = BuildStandardDispatch(driver, pickup);
}
```

This is an architectural cancer. Every new non-conforming provider adds another `if`. The fix is a configuration-driven dispatch builder, but the damage was caused by violating LSP at the service boundary.

### C# Architectural Application

In C#, LSP violations at the architectural level often appear as:

- **Repository implementations** that throw `NotSupportedException` for certain methods
- **Service adapters** that silently ignore parameters other implementations use
- **Message handlers** that don't handle all expected message types

The fix: design interfaces around what all implementations can actually do. Use ISP to split if needed.

---

## ISP — Interface Segregation Principle

**Core idea**: Don't depend on things you don't use.

**At class level**: Split fat interfaces into specific ones so clients only depend on methods they call.

**At architectural level**: Don't depend on frameworks/modules that bring unnecessary transitive dependencies. If framework F depends on database D, and your system S depends on F, then S transitively depends on D — even features of D that F doesn't use.

### Architectural Impact

```
S → F → D
```

A change in an unused feature of D can force redeployment of F and S. A failure in an unused module of D can crash F and S.

### C# Application

```csharp
// BAD: Fat interface forces implementors to know about everything
public interface IUserService
{
    User GetById(int id);
    void Save(User user);
    void SendWelcomeEmail(User user);
    Report GenerateActivityReport(User user);
    void SyncWithLdap(User user);
}

// GOOD: Segregated by concern
public interface IUserReader { User GetById(int id); }
public interface IUserWriter { void Save(User user); }
public interface IUserNotifier { void SendWelcomeEmail(User user); }
public interface IUserReporter { Report GenerateActivityReport(User user); }
```

At the **project level**, ISP means: don't reference a NuGet package or project just for one class. If `MyApp.Application` references `MyApp.Infrastructure` just to use a utility, extract that utility into a shared package or move it to the right layer.

---

## DIP — Dependency Inversion Principle

**Core idea**: Depend on abstractions, not concretions. Source code dependencies should point toward higher-level policies.

**At architectural level**: This is THE organizing principle. The curved line in Uncle Bob's diagrams is the architectural boundary. All dependencies cross it pointing toward the abstract/policy side.

### The Rules

1. **Don't refer to volatile concrete classes** — refer to abstract interfaces
2. **Don't derive from volatile concrete classes** — inheritance is the strongest coupling
3. **Don't override concrete functions** — you inherit their dependencies
4. **Never mention the name of anything concrete and volatile**

### The Abstract Factory Pattern

When you need to create concrete objects without depending on them:

```csharp
// Abstract side (inner layer)
public interface IService { void Execute(); }
public interface IServiceFactory { IService Create(); }

// Concrete side (outer layer)
public class ConcreteService : IService { public void Execute() { ... } }
public class ServiceFactory : IServiceFactory
{
    public IService Create() => new ConcreteService();
}
```

In modern C#, DI containers handle this — but the principle is the same: the application layer defines what it needs (interfaces), and the composition root (Main/Program.cs) wires up the concrete implementations.

### The Composition Root

```csharp
// Program.cs — the ONE place where concrete meets abstract
var builder = WebApplication.CreateBuilder(args);

// All concrete registrations happen here, nowhere else
builder.Services.AddScoped<IOrderRepository, SqlOrderRepository>();
builder.Services.AddScoped<IPaymentGateway, StripePaymentGateway>();
builder.Services.AddScoped<IEmailSender, SendGridEmailSender>();
builder.Services.AddScoped<ICreateOrderUseCase, CreateOrderInteractor>();
```

This is Uncle Bob's "Main component" — it's the dirtiest component, knowing about all concrete classes, but it's also the most peripheral. Changes here don't affect business rules.
