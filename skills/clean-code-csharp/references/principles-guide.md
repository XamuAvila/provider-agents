# Clean Code Principles Guide for C#

Deep-dive reference on the core principles from Clean Code, adapted for C# / .NET.

## Table of Contents
1. [Meaningful Names (Ch2)](#meaningful-names)
2. [Functions (Ch3)](#functions)
3. [Comments (Ch4)](#comments)
4. [Formatting (Ch5)](#formatting)
5. [Objects and Data Structures (Ch6)](#objects-and-data-structures)
6. [Error Handling (Ch7)](#error-handling)
7. [Boundaries (Ch8)](#boundaries)
8. [Unit Tests (Ch9)](#unit-tests)
9. [Classes (Ch10)](#classes)
10. [Emergence (Ch12)](#emergence)

---

## Meaningful Names

### Use Intention-Revealing Names

Every variable, function, and class name should answer: why it exists, what it does, and how it's used. If a name requires a comment, it doesn't reveal its intent.

```csharp
// Bad
int d; // elapsed time in days

// Good
int elapsedTimeInDays;
int daysSinceCreation;
int fileAgeInDays;
```

### Avoid Disinformation

Don't use names that mean something different to programmers. Don't use `accountList` unless it's actually a `List<T>`. Consider `accounts` or `accountGroup`.

Don't use names that vary in tiny ways: `XYZControllerForEfficientHandlingOfStrings` vs `XYZControllerForEfficientStorageOfStrings`.

### Make Meaningful Distinctions

If names must differ, make the distinction meaningful. Number-series naming (`a1`, `a2`) and noise words (`ProductInfo` vs `ProductData`) are non-informative.

```csharp
// Bad — what's the difference?
void CopyChars(char[] a1, char[] a2) { ... }

// Good
void CopyChars(char[] source, char[] destination) { ... }
```

### Use Pronounceable and Searchable Names

If you can't pronounce it, you can't discuss it. If it's a single letter, you can't search for it.

```csharp
// Bad
DateTime genymdhms; // generation year, month, day, hour, minute, second

// Good
DateTime generationTimestamp;
```

Single-letter names are only acceptable as loop counters in very short methods.

### Class Names and Method Names

- **Classes** → Nouns or noun phrases: `Customer`, `WikiPage`, `Account`, `AddressParser`
- **Methods** → Verbs or verb phrases: `PostPayment()`, `DeletePage()`, `Save()`
- **Accessors/Mutators** → C# properties: `public string Name { get; set; }`
- **Factory methods** → Name describes what's created: `Complex.FromRealNumber(23.0)`

### Don't Be Cute / Pick One Word per Concept

`Kill()` vs `Abort()` vs `Terminate()` — pick one and use it consistently. If you use `Get` in some services and `Fetch` in others, readers waste time wondering if there's a difference.

### Solution vs Problem Domain Names

Use CS terms when the pattern is well-known (`Visitor`, `Queue`, `JobQueue`). Use business domain terms when there's no CS equivalent (`AccountingLedger`, `FlightItinerary`).

---

## Functions

### Small!

Functions should be small. Then smaller. Rarely more than 20 lines. Ideally 5-10 lines.

Blocks inside `if`, `else`, and `while` should be one line — typically a method call. This keeps the enclosing function small and adds documentary value since the called function has a descriptive name.

```csharp
// Clean — each block is a single method call
public async Task<Markup> RenderPageWithSetupsAndTeardowns(
    PageData pageData, bool isSuite)
{
    if (IsTestPage(pageData))
        await IncludeSetupAndTeardownPages(pageData, isSuite);
    return pageData.GetHtml();
}
```

### Do One Thing

A function should do one thing, do it well, and do it only. If you can extract a function from it with a name that's not a restatement of its implementation, it does more than one thing.

### One Level of Abstraction per Function (Stepdown Rule)

Read code top to bottom. Each function should introduce the next level of abstraction:

```csharp
// High level
public async Task ProcessOrder(Order order)
{
    ValidateOrder(order);
    var payment = await ChargeCustomer(order);
    await FulfillOrder(order, payment);
    await NotifyCustomer(order);
}

// One level down
private void ValidateOrder(Order order)
{
    EnsureItemsInStock(order.Items);
    EnsureValidShippingAddress(order.ShippingAddress);
    EnsurePaymentMethodActive(order.PaymentMethod);
}
```

### Function Arguments

- **Zero (niladic)**: Best. `GetCurrentTime()`
- **One (monadic)**: Good. Asking a question (`bool FileExists(string path)`) or transforming (`InputStream OpenFile(string path)`) or event (`void PasswordAttemptFailed(int attempts)`)
- **Two (dyadic)**: OK when natural ordering exists (`new Point(x, y)`)
- **Three (triadic)**: Think very carefully
- **More**: Wrap into an object: `new Circle(center, radius)` instead of `MakeCircle(x, y, radius)`

In C#, use **records** or **parameter objects** to reduce argument count:

```csharp
// Before: 5 args
void CreateUser(string name, string email, string role, int deptId, bool active);

// After: 1 arg (record)
record CreateUserRequest(string Name, string Email, string Role, int DepartmentId, bool IsActive);
void CreateUser(CreateUserRequest request);
```

### No Side Effects

A function called `CheckPassword()` should only check the password — not also initialize a session. Side effects are hidden lies.

### Command Query Separation

A function should either **do something** (command) or **answer something** (query), not both.

```csharp
// Bad — does it set the attribute or check if it exists?
if (Set("username", "unclebob")) { ... }

// Good — separated
if (AttributeExists("username"))
    SetAttribute("username", "unclebob");
```

### Prefer Exceptions to Error Codes

Error codes force nested `if` statements. Exceptions let you separate the happy path from error handling.

```csharp
// Bad
if (DeletePage(page) == E_OK)
{
    if (registry.DeleteReference(page.Name) == E_OK)
    { ... }
    else
        logger.Log("deleteReference failed");
}

// Good
try
{
    DeletePage(page);
    registry.DeleteReference(page.Name);
    configKeys.DeleteKey(page.Name.MakeKey());
}
catch (Exception ex)
{
    logger.Log(ex.Message);
}
```

Extract try/catch bodies into methods — error handling IS one thing:

```csharp
public void Delete(Page page)
{
    try { DeletePageAndAllReferences(page); }
    catch (Exception ex) { LogError(ex); }
}

private void DeletePageAndAllReferences(Page page) { ... }
private void LogError(Exception ex) { ... }
```

---

## Comments

### The Best Comment Is No Comment

Code should express itself. Before writing a comment, try to express the same thing in code:

```csharp
// Bad
// Check to see if the employee is eligible for full benefits
if (employee.Flags.HasFlag(EmployeeFlags.HourlyTaker) && employee.Age > 65) { ... }

// Good
if (employee.IsEligibleForFullBenefits()) { ... }
```

### Good Comments

- **Legal comments**: Copyright headers (keep brief, reference license file)
- **Explanation of intent**: Why a decision was made, not what the code does
- **Clarification**: When the meaning of an opaque API argument isn't clear
- **Warning of consequences**: `// Don't run unless you have 8 hours to spare`
- **TODO comments**: Mark future work, but clean them up regularly
- **XML docs on public APIs**: Necessary for NuGet packages and shared libraries

### Bad Comments

- **Redundant**: XML doc that just restates the method signature
- **Misleading**: Comments that don't match what the code actually does
- **Mandated**: `/// <summary>` on every method regardless of need
- **Journal**: `// 2024-01-15: Fixed bug` — that's what Git is for
- **Noise**: `// Default constructor` on a default constructor
- **Closing brace**: `} // end while` — make the method shorter instead
- **Commented-out code**: Delete it. Always.

---

## Formatting

### Vertical Formatting

- **Small files**: 200-500 lines is ideal. Files over 500 lines deserve scrutiny.
- **Newspaper metaphor**: Name at the top should tell the story. Detail increases downward.
- **Vertical openness**: Blank lines between concepts (between methods, between logical sections).
- **Vertical density**: Related lines should stay close. Don't separate related declarations with blank lines.
- **Vertical distance**: Declare variables near usage. Keep related functions close. Callers above callees.

### Horizontal Formatting

- Lines under 120 characters.
- Use horizontal whitespace to associate related things and disassociate unrelated things:
  ```csharp
  total = price * quantity + tax;  // spaces around + but tight around *
  ```
- **Don't align declarations** in columns — it draws attention to the wrong thing.

### Team Rules

The team picks one set of rules and everyone follows them. Use `.editorconfig` in C#:

```ini
[*.cs]
indent_style = space
indent_size = 4
dotnet_sort_system_directives_first = true
csharp_style_var_for_built_in_types = true
csharp_style_expression_bodied_methods = when_on_single_line
```

---

## Objects and Data Structures

### The Core Asymmetry

- **Objects** hide data behind abstractions and expose behavior (methods). New types are easy to add (just add a class), but new behaviors are hard (must change all classes).
- **Data structures** expose data and have no meaningful behavior. New behaviors are easy (add a function), but new types are hard (must change all functions).

**Hybrid structures** (half object, half data structure) have the worst of both worlds. Avoid them.

### Law of Demeter

A method `f` of class `C` should only call methods on:
- `C` itself
- An object created by `f`
- An object passed as argument to `f`
- An instance variable of `C`

```csharp
// Bad — train wreck
string outputDir = context.GetOptions().GetScratchDir().GetAbsolutePath();

// Good
string outputDir = context.GetScratchDirectoryPath();
```

### DTOs and Records

Data Transfer Objects are pure data structures — no business logic. In C#, use records:

```csharp
public record OrderDto(int Id, string CustomerName, decimal Total, DateTime OrderDate);
```

**Active Records** (DTOs + navigation methods like Save/Find) are a common anti-pattern. Separate your domain model from your persistence mechanism.

---

## Error Handling

### Use Exceptions, Not Return Codes

Exceptions separate error handling from business logic. Return codes force interleaving.

### Write Try-Catch-Finally First

When writing a method that might throw, start with the `try-catch-finally` structure. This helps define the scope and expectations.

### Provide Context with Exceptions

Include enough info to determine the source and nature of the error:

```csharp
// Bad
throw new Exception("Error");

// Good
throw new InvalidOperationException(
    $"Failed to connect to payment gateway '{gatewayUrl}' " +
    $"for order {orderId}. Timeout after {timeoutMs}ms.");
```

### Define Exceptions by Caller's Needs

Wrap third-party APIs so you can throw your own exceptions:

```csharp
// Wrapper that simplifies exception handling for callers
public class PaymentGateway
{
    public async Task<PaymentResult> ChargeAsync(PaymentRequest request)
    {
        try
        {
            return await _stripeClient.ChargeAsync(request.ToStripeRequest());
        }
        catch (StripeRateLimitException ex)
        {
            throw new PaymentTemporarilyUnavailableException(ex);
        }
        catch (StripeAuthException ex)
        {
            throw new PaymentConfigurationException(ex);
        }
        catch (StripeException ex)
        {
            throw new PaymentFailedException(ex);
        }
    }
}
```

### Don't Return Null / Don't Pass Null

Returning `null` forces null checks everywhere. Consider:

```csharp
// Instead of returning null
public IReadOnlyList<Employee> GetEmployees()
{
    // Return empty list, not null
    return _employees?.AsReadOnly() ?? Array.Empty<Employee>();
}

// Use nullable reference types to make intent clear
public Employee? FindById(int id) => _employees.FirstOrDefault(e => e.Id == id);
```

Use the **Special Case / Null Object pattern** when appropriate:

```csharp
public interface IMealPlan { IReadOnlyList<Meal> GetMeals(); }
public class NullMealPlan : IMealPlan
{
    public IReadOnlyList<Meal> GetMeals() => Array.Empty<Meal>();
}
```

---

## Boundaries

### Wrapping Third-Party APIs

Don't let third-party APIs leak into your codebase. Wrap them:

- Easier to mock for tests
- Minimizes migration cost when you switch libraries
- You control your API's shape

```csharp
// Boundary wrapper
public class LoggerAdapter : IAppLogger
{
    private readonly Serilog.ILogger _serilog;
    
    public void LogInfo(string message) => _serilog.Information(message);
    public void LogError(Exception ex, string message) => _serilog.Error(ex, message);
}
```

### Learning Tests

When integrating a third-party API, write tests that validate your understanding of its behavior. These tests also serve as early warning when you upgrade the package.

---

## Unit Tests

### The Three Laws of TDD

1. Don't write production code until you've written a failing test
2. Don't write more of a test than is sufficient to fail
3. Don't write more production code than is sufficient to pass

### Keep Tests Clean

Test code is as important as production code. It needs the same care for readability and maintenance.

### One Concept per Test

```csharp
// Bad — testing 3 concepts
[Fact]
public void TestMiscStuff()
{
    // Test sorting
    // Test filtering
    // Test pagination
}

// Good — one concept each
[Fact] public void SortsByPriceAscendingByDefault() { ... }
[Fact] public void FiltersOutOfStockItems() { ... }
[Fact] public void ReturnsRequestedPageSize() { ... }
```

### F.I.R.S.T. Principles

- **Fast**: Tests run quickly so you run them frequently
- **Independent**: Tests don't depend on each other's state
- **Repeatable**: Run in any environment (dev, CI, offline)
- **Self-Validating**: Boolean output — pass or fail, no manual inspection
- **Timely**: Written just before or alongside production code

### Domain-Specific Testing Language

Build helper methods that make tests read like specifications:

```csharp
[Fact]
public void DelinquentAccountReceivesWarningEmail()
{
    var account = AnAccount()
        .WithBalance(-100)
        .PastDueSince(30.DaysAgo())
        .Build();
    
    _service.ProcessDelinquent(account);
    
    ShouldHaveSent.WarningEmailTo(account.Email);
}
```

---

## Classes

### Classes Should Be Small (SRP)

A class should have **one reason to change**. If you can't describe its purpose in about 25 words without using "and" or "or", it likely has too many responsibilities.

```csharp
// Bad — too many reasons to change
public class Employee
{
    public decimal CalculatePay() { ... }
    public void Save() { ... }
    public string GenerateReport() { ... }
}

// Good — each class has one responsibility
public class Employee { /* domain data and behavior */ }
public class EmployeeRepository { public void Save(Employee e) { ... } }
public class EmployeeReportGenerator { public string Generate(Employee e) { ... } }
```

### Cohesion

A class is maximally cohesive when each method uses every instance variable. When cohesion drops, consider splitting the class.

### Organizing for Change (OCP)

Classes should be open for extension, closed for modification. When new requirements come, you should be adding new classes, not modifying existing ones.

```csharp
// Follows OCP — new SQL types = new class, no existing class changes
public abstract class SqlStatement
{
    public abstract string Generate();
}
public class SelectStatement : SqlStatement { ... }
public class InsertStatement : SqlStatement { ... }
// Adding UPDATE? Just create UpdateStatement. No existing code changes.
```

---

## Emergence

Kent Beck's **Four Rules of Simple Design** (in priority order):

1. **Runs all the tests** — A system that can't be verified isn't verifiable. Design for testability (DI, interfaces, small classes) leads to better design.
2. **Contains no duplication** — After tests pass, refactor to eliminate duplication. Every duplicate is a missed abstraction.
3. **Expresses the intent of the programmer** — Choose good names, keep things small, use standard patterns. The clearer the code, the less time others spend understanding it.
4. **Minimizes the number of classes and methods** — Don't create abstractions just for the sake of it. Pragmatism over dogma. But this is the *lowest priority* rule.
