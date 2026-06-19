# Clean Architecture: C#/.NET Implementation Guide

Practical patterns for implementing Clean Architecture in .NET solutions.

## Table of Contents
1. [Solution Structure](#solution-structure)
2. [Domain Layer](#domain-layer)
3. [Application Layer](#application-layer)
4. [Infrastructure Layer](#infrastructure-layer)
5. [Presentation Layer](#presentation-layer)
6. [Composition Root](#composition-root)
7. [Common Mistakes](#common-mistakes)

---

## Solution Structure

### Standard .NET Solution Layout

```
MyApp/
├── src/
│   ├── MyApp.Domain/              ← Entities, Value Objects, Domain Events, Domain Services
│   │   ├── Entities/
│   │   ├── ValueObjects/
│   │   ├── Events/
│   │   ├── Services/
│   │   ├── Enums/
│   │   └── Exceptions/
│   │
│   ├── MyApp.Application/         ← Use Cases, DTOs, Interfaces (ports)
│   │   ├── UseCases/              (or Features/, or Commands/ + Queries/)
│   │   │   ├── CreateOrder/
│   │   │   │   ├── CreateOrderCommand.cs
│   │   │   │   ├── CreateOrderHandler.cs
│   │   │   │   └── CreateOrderValidator.cs
│   │   │   └── GetOrder/
│   │   │       ├── GetOrderQuery.cs
│   │   │       ├── GetOrderHandler.cs
│   │   │       └── OrderDto.cs
│   │   ├── Interfaces/            (output ports)
│   │   │   ├── IOrderRepository.cs
│   │   │   ├── IPaymentGateway.cs
│   │   │   └── IEmailSender.cs
│   │   └── Common/
│   │       ├── Behaviors/
│   │       └── Mappings/
│   │
│   ├── MyApp.Infrastructure/      ← Database, External Services, File System
│   │   ├── Persistence/
│   │   │   ├── AppDbContext.cs
│   │   │   ├── Repositories/
│   │   │   ├── Configurations/    (EF Core entity configs)
│   │   │   └── Migrations/
│   │   ├── ExternalServices/
│   │   │   ├── StripePaymentGateway.cs
│   │   │   └── SendGridEmailSender.cs
│   │   └── DependencyInjection.cs
│   │
│   └── MyApp.WebApi/              ← ASP.NET Core, Controllers, Middleware
│       ├── Controllers/
│       ├── Middleware/
│       ├── Filters/
│       └── Program.cs
│
└── tests/
    ├── MyApp.Domain.Tests/
    ├── MyApp.Application.Tests/
    ├── MyApp.Infrastructure.Tests/
    └── MyApp.WebApi.Tests/
```

### Project References (Dependency Rule)

```
MyApp.Domain         → references NOTHING (innermost circle)
MyApp.Application    → references MyApp.Domain only
MyApp.Infrastructure → references MyApp.Application (and transitively, Domain)
MyApp.WebApi         → references MyApp.Application and MyApp.Infrastructure
```

The WebApi project is the composition root — it knows about everything to wire up DI.

---

## Domain Layer

The innermost circle. Zero external dependencies. No NuGet packages except perhaps a DDD building-blocks library.

### Entities

```csharp
namespace MyApp.Domain.Entities;

public class Order
{
    private readonly List<OrderLine> _lines = new();

    public int Id { get; private set; }
    public string CustomerId { get; private set; }
    public OrderStatus Status { get; private set; }
    public IReadOnlyList<OrderLine> Lines => _lines.AsReadOnly();
    public decimal Total => _lines.Sum(l => l.Subtotal);

    // Factory method — encapsulates creation rules
    public static Order Create(string customerId)
    {
        if (string.IsNullOrWhiteSpace(customerId))
            throw new DomainException("Customer ID is required");

        return new Order { CustomerId = customerId, Status = OrderStatus.Draft };
    }

    // Business behavior lives here, not in a service
    public void AddLine(string productId, int quantity, decimal unitPrice)
    {
        if (Status != OrderStatus.Draft)
            throw new DomainException("Cannot modify a submitted order");

        if (quantity <= 0)
            throw new DomainException("Quantity must be positive");

        _lines.Add(new OrderLine(productId, quantity, unitPrice));
    }

    public void Submit()
    {
        if (!_lines.Any())
            throw new DomainException("Cannot submit an empty order");

        Status = OrderStatus.Submitted;
        // Optionally raise a domain event
    }
}
```

### Value Objects

```csharp
namespace MyApp.Domain.ValueObjects;

public record Money(decimal Amount, string Currency)
{
    public static Money Zero(string currency) => new(0, currency);

    public Money Add(Money other)
    {
        if (Currency != other.Currency)
            throw new DomainException($"Cannot add {Currency} to {other.Currency}");
        return new Money(Amount + other.Amount, Currency);
    }
}

public record Address(string Street, string City, string State, string ZipCode, string Country);
```

### Domain Services

For business logic that doesn't naturally belong to a single entity:

```csharp
namespace MyApp.Domain.Services;

public class PricingService
{
    public Money CalculateDiscount(Order order, CustomerTier tier)
    {
        var discount = tier switch
        {
            CustomerTier.Gold => 0.10m,
            CustomerTier.Platinum => 0.15m,
            _ => 0m
        };
        return new Money(order.Total * discount, "BRL");
    }
}
```

---

## Application Layer

Use cases / interactors. Orchestrates domain objects. Defines ports (interfaces) for external dependencies.

### Use Case (Command + Handler Pattern)

```csharp
namespace MyApp.Application.UseCases.CreateOrder;

// Input DTO (Command)
public record CreateOrderCommand(
    string CustomerId,
    List<OrderLineDto> Lines
);

public record OrderLineDto(string ProductId, int Quantity, decimal UnitPrice);

// Output DTO
public record CreateOrderResult(int OrderId, decimal Total);

// The Use Case itself (Interactor)
public class CreateOrderHandler
{
    private readonly IOrderRepository _orderRepo;
    private readonly IPaymentGateway _paymentGateway;
    private readonly IUnitOfWork _unitOfWork;

    public CreateOrderHandler(
        IOrderRepository orderRepo,
        IPaymentGateway paymentGateway,
        IUnitOfWork unitOfWork)
    {
        _orderRepo = orderRepo;
        _paymentGateway = paymentGateway;
        _unitOfWork = unitOfWork;
    }

    public async Task<CreateOrderResult> HandleAsync(CreateOrderCommand command)
    {
        // 1. Create domain entity
        var order = Order.Create(command.CustomerId);

        // 2. Apply business rules
        foreach (var line in command.Lines)
            order.AddLine(line.ProductId, line.Quantity, line.UnitPrice);

        order.Submit();

        // 3. Persist
        await _orderRepo.AddAsync(order);
        await _unitOfWork.SaveChangesAsync();

        // 4. Return result
        return new CreateOrderResult(order.Id, order.Total);
    }
}
```

### Output Ports (Interfaces)

Defined in Application, implemented in Infrastructure:

```csharp
namespace MyApp.Application.Interfaces;

public interface IOrderRepository
{
    Task<Order?> GetByIdAsync(int id);
    Task AddAsync(Order order);
}

public interface IPaymentGateway
{
    Task<PaymentResult> ChargeAsync(string customerId, decimal amount, string currency);
}

public interface IEmailSender
{
    Task SendAsync(string to, string subject, string body);
}

public interface IUnitOfWork
{
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
```

### With MediatR (Optional)

MediatR is popular but not required. It adds a layer of indirection that routes commands/queries to handlers:

```csharp
// Command
public record CreateOrderCommand(...) : IRequest<CreateOrderResult>;

// Handler
public class CreateOrderHandler : IRequestHandler<CreateOrderCommand, CreateOrderResult>
{
    public async Task<CreateOrderResult> Handle(
        CreateOrderCommand request, CancellationToken ct) { ... }
}

// Controller just dispatches
[HttpPost]
public async Task<IActionResult> Create(CreateOrderRequest request)
{
    var result = await _mediator.Send(new CreateOrderCommand(...));
    return Ok(result);
}
```

---

## Infrastructure Layer

Implements the interfaces defined in Application. All framework and external service coupling lives here.

### Repository Implementation (EF Core)

```csharp
namespace MyApp.Infrastructure.Persistence.Repositories;

public class SqlOrderRepository : IOrderRepository
{
    private readonly AppDbContext _db;

    public SqlOrderRepository(AppDbContext db) => _db = db;

    public async Task<Order?> GetByIdAsync(int id)
        => await _db.Orders
            .Include(o => o.Lines)
            .FirstOrDefaultAsync(o => o.Id == id);

    public async Task AddAsync(Order order)
        => await _db.Orders.AddAsync(order);
}

// UnitOfWork wraps DbContext.SaveChanges
public class UnitOfWork : IUnitOfWork
{
    private readonly AppDbContext _db;
    public UnitOfWork(AppDbContext db) => _db = db;
    public Task<int> SaveChangesAsync(CancellationToken ct)
        => _db.SaveChangesAsync(ct);
}
```

### External Service Adapter

```csharp
namespace MyApp.Infrastructure.ExternalServices;

public class StripePaymentGateway : IPaymentGateway
{
    private readonly StripeClient _client;

    public StripePaymentGateway(IOptions<StripeOptions> options)
    {
        _client = new StripeClient(options.Value.ApiKey);
    }

    public async Task<PaymentResult> ChargeAsync(
        string customerId, decimal amount, string currency)
    {
        try
        {
            var charge = await _client.ChargeAsync(new ChargeRequest
            {
                Amount = (long)(amount * 100),
                Currency = currency,
                CustomerId = customerId
            });
            return PaymentResult.Success(charge.Id);
        }
        catch (StripeException ex)
        {
            return PaymentResult.Failure(ex.Message);
        }
    }
}
```

### DI Registration Module

Each layer can expose a registration extension method:

```csharp
namespace MyApp.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services, IConfiguration config)
    {
        // Persistence
        services.AddDbContext<AppDbContext>(options =>
            options.UseNpgsql(config.GetConnectionString("Default")));

        services.AddScoped<IOrderRepository, SqlOrderRepository>();
        services.AddScoped<IUnitOfWork, UnitOfWork>();

        // External services
        services.Configure<StripeOptions>(config.GetSection("Stripe"));
        services.AddScoped<IPaymentGateway, StripePaymentGateway>();

        services.Configure<SendGridOptions>(config.GetSection("SendGrid"));
        services.AddScoped<IEmailSender, SendGridEmailSender>();

        return services;
    }
}
```

---

## Presentation Layer

ASP.NET Core controllers, middleware, and view models. Translates HTTP requests to Application commands/queries.

```csharp
namespace MyApp.WebApi.Controllers;

[ApiController]
[Route("api/orders")]
public class OrdersController : ControllerBase
{
    private readonly CreateOrderHandler _createOrder;
    private readonly GetOrderHandler _getOrder;

    public OrdersController(
        CreateOrderHandler createOrder,
        GetOrderHandler getOrder)
    {
        _createOrder = createOrder;
        _getOrder = getOrder;
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateOrderRequest request)
    {
        // Map API request → Application command
        var command = new CreateOrderCommand(
            request.CustomerId,
            request.Lines.Select(l => new OrderLineDto(l.ProductId, l.Quantity, l.UnitPrice)).ToList()
        );

        var result = await _createOrder.HandleAsync(command);
        return CreatedAtAction(nameof(GetById), new { id = result.OrderId }, result);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var result = await _getOrder.HandleAsync(new GetOrderQuery(id));
        return result is not null ? Ok(result) : NotFound();
    }
}
```

---

## Composition Root

`Program.cs` is the Main component — it wires everything together:

```csharp
var builder = WebApplication.CreateBuilder(args);

// Each layer registers its own services
builder.Services.AddApplication();       // from MyApp.Application
builder.Services.AddInfrastructure(      // from MyApp.Infrastructure
    builder.Configuration);
builder.Services.AddControllers();

var app = builder.Build();
app.MapControllers();
app.Run();
```

---

## Common Mistakes

### 1. Domain depends on Infrastructure

```csharp
// WRONG: Entity uses EF Core attributes
using System.ComponentModel.DataAnnotations.Schema;

public class Order
{
    [Column("order_id")]
    public int Id { get; set; }
}
```

Fix: Use EF Core Fluent API in Infrastructure layer, keep Domain clean.

### 2. Application layer returns Entity objects

```csharp
// WRONG: Leaks domain entity to outer circles
public async Task<Order> Handle(GetOrderQuery query)
    => await _repo.GetByIdAsync(query.Id);
```

Fix: Map to a DTO before returning.

### 3. Use Case depends on ASP.NET types

```csharp
// WRONG: Use case knows about HTTP
public async Task<IActionResult> Handle(CreateOrderCommand cmd) { ... }
```

Fix: Use cases return domain DTOs. Controllers decide the HTTP response.

### 4. Business rules in Controllers

```csharp
// WRONG: Controller contains business logic
[HttpPost]
public async Task<IActionResult> Create(CreateOrderRequest request)
{
    if (request.Lines.Sum(l => l.Quantity * l.Price) > 10000)
        return BadRequest("Order exceeds credit limit");
    // ...
}
```

Fix: Move validation to the domain or application layer.

### 5. Referencing Infrastructure from Domain

```csharp
// WRONG: Domain project references Infrastructure NuGet packages
// MyApp.Domain.csproj
<PackageReference Include="Npgsql.EntityFrameworkCore.PostgreSQL" />
```

Fix: Domain project should have zero infrastructure package references. Ideally zero NuGet packages altogether.

### 6. Over-engineering

Not every app needs 4 layers. For a simple CRUD API:
- Start with 2 projects: `MyApp.Core` (entities + use cases) + `MyApp.Api` (everything else)
- Extract Infrastructure when you need to swap implementations or the project grows
- Add boundaries when the pain of not having them exceeds the cost of adding them

This is the lesson of **Partial Boundaries** (Chapter 24): architecture should grow with the system, not precede it.
