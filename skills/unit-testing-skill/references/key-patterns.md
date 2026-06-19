# Key Patterns Reference — Unit Testing

## Table of Contents
1. [Test Naming Examples](#test-naming-examples)
2. [Stub Patterns](#stub-patterns)
3. [Mock Patterns](#mock-patterns)
4. [Factory Method Patterns](#factory-method-patterns)
5. [Dependency Injection for Testability](#dependency-injection-for-testability)
6. [Anti-patterns Gallery](#anti-patterns-gallery)
7. [Integration vs Unit Test Decision](#integration-vs-unit-test-decision)
8. [TypeScript/Jest Equivalents](#typescriptjest-equivalents)

---

## Test Naming Examples

Pattern: `[UnitOfWork]_[Scenario]_[ExpectedBehavior]`

| Unit of Work | Scenario | Expected Behavior | Full Name |
|---|---|---|---|
| IsValid | Empty filename | Returns false | `IsValid_EmptyFileName_ReturnsFalse` |
| IsValid | Valid extension | Returns true | `IsValid_ValidExtension_ReturnsTrue` |
| Add | Negative number | Throws exception | `Add_NegativeNumber_ThrowsArgumentException` |
| Withdraw | Insufficient funds | Does not change balance | `Withdraw_InsufficientFunds_BalanceUnchanged` |
| SendEmail | Valid recipient | Calls email gateway | `SendEmail_ValidRecipient_CallsGateway` |
| Login | Expired token | Returns unauthorized | `Login_ExpiredToken_ReturnsUnauthorized` |
| CreateOrder | Out of stock | Returns failure result | `CreateOrder_OutOfStock_ReturnsFailure` |

For TypeScript/Jest, use describe/it blocks:
```typescript
describe('OrderService.createOrder', () => {
  it('should return failure when item is out of stock', () => { ... });
  it('should call inventory service when order is valid', () => { ... });
  it('should persist order when all validations pass', () => { ... });
});
```

---

## Stub Patterns

### Pattern: Stub returning a value (C#)
```csharp
// Arrange
var stubParser = Substitute.For<IFileParser>();
stubParser.Parse("config.json").Returns(new Config { Timeout = 30 });

var sut = new ConfigLoader(stubParser);

// Act
var result = sut.LoadTimeout();

// Assert — we assert on the SUT's result, NOT on the stub
Assert.AreEqual(30, result);
```

### Pattern: Stub simulating an exception
```csharp
var stubService = Substitute.For<IPaymentGateway>();
stubService.Charge(Arg.Any<decimal>()).Throws(new TimeoutException());

var sut = new OrderProcessor(stubService);
var result = sut.ProcessPayment(100m);

Assert.AreEqual(OrderStatus.PaymentFailed, result.Status);
```

### Pattern: Stub with conditional returns
```csharp
var stubRepo = Substitute.For<IUserRepository>();
stubRepo.FindById(1).Returns(new User { Name = "Alice" });
stubRepo.FindById(2).Returns((User)null);
```

---

## Mock Patterns

### Pattern: Verify a call was made (interaction testing)
```csharp
// Arrange
var mockLogger = Substitute.For<ILogger>();
var sut = new UserService(mockLogger);

// Act
sut.DeleteUser(42);

// Assert — we verify the MOCK was called
mockLogger.Received(1).Log(Arg.Is<string>(s => s.Contains("deleted")));
```

### Pattern: Mock + Stub together
```csharp
// stubRepo provides data (no assertion on it)
var stubRepo = Substitute.For<IOrderRepository>();
stubRepo.GetById(1).Returns(new Order { Total = 500 });

// mockNotifier is what we verify (assert on it)
var mockNotifier = Substitute.For<INotificationService>();

var sut = new OrderCanceller(stubRepo, mockNotifier);
sut.Cancel(1);

// Assert only on the mock
mockNotifier.Received(1).SendCancellation(Arg.Is<int>(id => id == 1));
```

### Critical: One mock per test
```
WRONG: Assert mockA received X AND mockB received Y
RIGHT: Split into two tests, each with one mock
```

---

## Factory Method Patterns

### Problem: Object creation duplicated across tests
```csharp
// BAD — every test creates the same setup
[Test]
public void Test1()
{
    var analyzer = new LogAnalyzer();
    analyzer.Initialize();
    analyzer.SetMinLength(5);
    // ... test
}

[Test]
public void Test2()
{
    var analyzer = new LogAnalyzer();
    analyzer.Initialize();
    analyzer.SetMinLength(5);
    // ... different test, same setup
}
```

### Solution: Factory method
```csharp
private static LogAnalyzer MakeAnalyzer(int minLength = 5)
{
    var analyzer = new LogAnalyzer();
    analyzer.Initialize();
    analyzer.SetMinLength(minLength);
    return analyzer;
}

[Test]
public void IsValid_ShortFileName_ReturnsFalse()
{
    var sut = MakeAnalyzer(minLength: 5);
    Assert.IsFalse(sut.IsValid("ab"));
}
```

If the constructor of LogAnalyzer changes, you only fix the factory method.

---

## Dependency Injection for Testability

### Constructor Injection (preferred)
```csharp
// Production
public class OrderService
{
    private readonly IOrderRepository _repo;
    private readonly IEmailService _email;

    public OrderService(IOrderRepository repo, IEmailService email)
    {
        _repo = repo;
        _email = email;
    }
}

// Test
var stubRepo = Substitute.For<IOrderRepository>();
var mockEmail = Substitute.For<IEmailService>();
var sut = new OrderService(stubRepo, mockEmail);
```

### Extract and Override (for legacy code)
```csharp
// Production — hard to test because it creates its own dependency
public class OrderService
{
    public void ProcessOrder(Order order)
    {
        var logger = new FileLogger(); // hard-coded dependency!
        logger.Log("Processing " + order.Id);
        // ... logic
    }
}

// Step 1: Extract to virtual method
public class OrderService
{
    public void ProcessOrder(Order order)
    {
        var logger = GetLogger(); // extracted
        logger.Log("Processing " + order.Id);
    }

    protected virtual ILogger GetLogger()
    {
        return new FileLogger();
    }
}

// Step 2: Override in test
public class TestableOrderService : OrderService
{
    public ILogger StubLogger { get; set; }
    protected override ILogger GetLogger() => StubLogger;
}

// Step 3: Use in test
var stubLogger = Substitute.For<ILogger>();
var sut = new TestableOrderService { StubLogger = stubLogger };
```

---

## Anti-patterns Gallery

### 1. Logic in tests
```csharp
// BAD — if statement in test
[Test]
public void BadTest()
{
    var result = sut.Calculate(input);
    if (input > 0)
        Assert.IsTrue(result > 0);
    else
        Assert.AreEqual(0, result);
}

// GOOD — separate tests
[Test]
public void Calculate_PositiveInput_ReturnsPositive() { ... }

[Test]
public void Calculate_ZeroInput_ReturnsZero() { ... }
```

### 2. Testing implementation instead of behavior
```csharp
// BAD — testing that a specific internal method was called
mockRepo.Received(1).ExecuteSql(Arg.Is<string>(s => s.Contains("INSERT")));

// GOOD — testing the observable outcome
var savedOrder = stubRepo.GetById(orderId);
Assert.IsNotNull(savedOrder);
Assert.AreEqual("Pending", savedOrder.Status);
```

### 3. Shared state between tests
```csharp
// BAD — static shared state
private static int _testCounter = 0;

[Test]
public void Test1() { _testCounter++; Assert.AreEqual(1, _testCounter); }

[Test]
public void Test2() { _testCounter++; Assert.AreEqual(1, _testCounter); } // FAILS!

// GOOD — each test independent
[SetUp]
public void Setup() { _counter = 0; }
```

### 4. Overspecification
```csharp
// BAD — tests break when implementation changes even if behavior is the same
mockRepo.Received(1).Save(Arg.Is<User>(u =>
    u.Name == "Alice" &&
    u.Email == "alice@test.com" &&
    u.CreatedAt.Year == 2024 &&
    u.ModifiedBy == "system"
));

// GOOD — verify only what matters for this test
mockRepo.Received(1).Save(Arg.Is<User>(u => u.Name == "Alice"));
```

### 5. Multiple concerns in one test
```csharp
// BAD — testing two different things
[Test]
public void UserService_DoesEverything()
{
    var result = sut.CreateUser("Alice");
    Assert.IsNotNull(result);              // concern 1: creation
    mockEmail.Received(1).SendWelcome();   // concern 2: notification
}

// GOOD — separate tests
[Test]
public void CreateUser_ValidName_ReturnsUser() { ... }

[Test]
public void CreateUser_ValidName_SendsWelcomeEmail() { ... }
```

---

## Integration vs Unit Test Decision

| Question | If Yes → | If No → |
|---|---|---|
| Does it touch the filesystem? | Integration | Could be unit |
| Does it talk to a database? | Integration | Could be unit |
| Does it make HTTP calls? | Integration | Could be unit |
| Does it need network access? | Integration | Could be unit |
| Can it run in parallel with other tests? | Likely unit | Likely integration |
| Does it run in < 100ms? | Likely unit | Likely integration |
| Does it always produce the same result? | Likely unit | Likely integration |

**Rule of thumb**: If you can't control all the inputs and outputs, it's an integration test. Unit tests control everything through test doubles.

---

## TypeScript/Jest Equivalents

### Stubs with Jest
```typescript
const mockRepo = {
  findById: jest.fn().mockResolvedValue({ id: 1, name: 'Alice' }),
  save: jest.fn().mockResolvedValue(undefined),
};

const sut = new UserService(mockRepo as any);
const result = await sut.getUser(1);
expect(result.name).toBe('Alice');
```

### Mocks with Jest (verify calls)
```typescript
const mockNotifier = {
  send: jest.fn(),
};

const sut = new OrderService(mockNotifier);
await sut.cancelOrder(1);

expect(mockNotifier.send).toHaveBeenCalledWith(
  expect.objectContaining({ type: 'cancellation', orderId: 1 })
);
```

### NestJS Testing Module
```typescript
const module = await Test.createTestingModule({
  providers: [
    OrderService,
    { provide: IOrderRepository, useValue: mockRepo },
    { provide: INotificationService, useValue: mockNotifier },
  ],
}).compile();

const sut = module.get<OrderService>(OrderService);
```

### Factory pattern in TS tests
```typescript
function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    total: 100,
    status: 'pending',
    createdAt: new Date(),
    ...overrides,
  };
}

it('should mark as cancelled', async () => {
  const order = makeOrder({ status: 'confirmed' });
  // ...
});
```
