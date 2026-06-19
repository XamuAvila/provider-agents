# Clean Code Smells & Heuristics Checklist

This is the complete catalog from Chapter 17 of Clean Code, adapted for C# code review. Use these codes when identifying issues.

## Comments

| Code | Smell | C# Notes |
|------|-------|----------|
| C1 | **Inappropriate Information** — Comment holds info that belongs in source control, issue tracker, or other systems (authors, change history, SPR numbers) | Remove `// Modified by X on Y` comments. Use Git blame instead. |
| C2 | **Obsolete Comment** — Comment is old, irrelevant, or incorrect. They migrate away from the code they described. | Delete or update immediately. XML doc comments on internal methods go stale fast. |
| C3 | **Redundant Comment** — Describes something the code already says clearly. `i++; // increment i` | Especially common with XML doc: `/// <summary>Gets the name</summary>` on `public string Name { get; }` |
| C4 | **Poorly Written Comment** — Worth writing = worth writing well. Use correct grammar, be brief, don't ramble. | Applies to `// TODO:` comments too — make them actionable. |
| C5 | **Commented-Out Code** — Rots over time, follows obsolete conventions. Delete it — source control remembers. | `// var oldService = new LegacyService();` — just delete it. |

## Environment

| Code | Smell | C# Notes |
|------|-------|----------|
| E1 | **Build Requires More Than One Step** — Should be a single trivial operation. | `dotnet build` should be all you need. No manual NuGet restores or separate config steps. |
| E2 | **Tests Require More Than One Step** — Run all tests with one command. | `dotnet test` from the root. No database seeding or manual setup required. |

## Functions

| Code | Smell | C# Notes |
|------|-------|----------|
| F1 | **Too Many Arguments** — Zero is best, then one, two, three. More than three is very questionable. | Use parameter objects, builder patterns, or C# records: `public record CreateOrderRequest(string CustomerId, decimal Amount, string Currency);` |
| F2 | **Output Arguments** — Counterintuitive. Readers expect inputs, not outputs. | Avoid `out` parameters when possible. Return a result object or tuple instead. Exception: `TryParse` pattern is idiomatic C#. |
| F3 | **Flag Arguments** — Boolean args declare the function does more than one thing. | Split into two methods: instead of `Render(bool isSuite)`, use `RenderForSuite()` and `RenderForSingleTest()`. |
| F4 | **Dead Function** — Never called. Delete it. Source control remembers. | Use IDE tools (Rider/VS "Find Usages") to verify before deleting. |

## General

| Code | Smell | C# Notes |
|------|-------|----------|
| G1 | **Multiple Languages in One Source File** — Minimize extra languages. | Watch for SQL strings, JSON literals, HTML templates embedded in C# files. Use resource files or separate concerns. |
| G2 | **Obvious Behavior Is Unimplemented** — The Principle of Least Surprise. Functions should do what their name implies. | `ParseDay("Monday")` should handle "monday", "Mon", "MONDAY". |
| G3 | **Incorrect Behavior at the Boundaries** — Don't trust intuition. Write tests for every boundary. | Off-by-one in LINQ `.Take()`, `.Skip()`, empty collections, null inputs. |
| G4 | **Overridden Safeties** — Don't suppress warnings, skip tests, or ignore analyzer rules without justification. | `#pragma warning disable`, `[SuppressMessage]`, `catch { }` — all red flags. |
| G5 | **Duplication** — The most important rule. Every duplication is a missed abstraction opportunity. | Identical code → extract method. Similar switch/case → polymorphism. Similar algorithms → Template Method or Strategy pattern. |
| G6 | **Code at Wrong Level of Abstraction** — Higher-level concepts in base classes, details in derivatives. Separation must be complete. | An `IRepository<T>` shouldn't have `SqlConnection`-level details. |
| G7 | **Base Classes Depending on Their Derivatives** — Base should know nothing about derivatives. | Base class referencing a derived type name = coupling violation. |
| G8 | **Too Much Information** — Well-defined modules have small interfaces. Hide data, hide utilities, keep coupling low. | Use `internal`, `private`, expose only what's needed. Prefer small interfaces over large ones. |
| G9 | **Dead Code** — Unreachable `if` branches, empty `catch` blocks, unused methods. Delete it. | `if (false)`, unreachable code after `return`, unused `case` branches. |
| G10 | **Vertical Separation** — Declare variables near first usage. Define private methods just below their first call. | Don't declare all variables at the top of the method — that's C89, not C#. |
| G11 | **Inconsistency** — Do similar things the same way throughout. | If you use `response` in one method for `HttpResponseMessage`, use it everywhere. If one service uses `async Task`, they all should. |
| G12 | **Clutter** — Unused variables, empty constructors, needless comments. Remove them. | Empty `static` constructors, unused `using` directives, default parameter values that are never overridden. |
| G13 | **Artificial Coupling** — Don't put things together just because it's convenient. | A general-purpose `enum` inside a specific class forces everyone to depend on that class. Move it to its own file. |
| G14 | **Feature Envy** — A method that uses too many members of another class. It wants to be in that other class. | `calculator.Calculate(order.Price, order.Tax, order.Discount)` → the calculation probably belongs in `Order`. |
| G15 | **Selector Arguments** — Boolean/enum args that select behavior. Split into separate methods. | `ProcessPayment(PaymentType type)` → `ProcessCreditCard()`, `ProcessBankTransfer()`. |
| G16 | **Obscured Intent** — Code should be expressive. No Hungarian notation, no cryptic abbreviations. | `var m_otCalc = iThsWkd * iThsRte` → unreadable. Spell it out. |
| G17 | **Misplaced Responsibility** — Code placed where convenient, not where intuitive. Follow Principle of Least Surprise. | Where should `CalculateTotal()` live? The class whose name implies that responsibility. |
| G18 | **Inappropriate Static** — If there's any chance you'll want polymorphism, make it non-static. | `PayCalculator.Calculate(employee)` → should probably be `employee.CalculatePay()` or use DI. |
| G19 | **Use Explanatory Variables** — Break complex expressions into named intermediates. | `var isEligible = age >= 18 && hasConsent;` is clearer than inlining the expression. |
| G20 | **Function Names Should Say What They Do** — `date.Add(5)` adds what? Days? Hours? Use `AddDays(5)`. | C#'s `DateTime.AddDays()` already follows this. Apply the same precision to your own APIs. |
| G21 | **Understand the Algorithm** — Don't just make it pass tests. Understand *why* it works, then refactor until it's obvious. | If you needed trial-and-error to make it work, refactor until the logic is self-evident. |
| G22 | **Make Logical Dependencies Physical** — Don't assume; explicitly ask for what you depend on. | Don't hardcode `PAGE_SIZE = 55` — inject it or ask the formatter for `GetMaxPageSize()`. |
| G23 | **Prefer Polymorphism to If/Else or Switch/Case** — ONE SWITCH rule: one switch per selection type, creating polymorphic objects. | In C#, use `switch` expressions for simple mapping, but use polymorphism when the same condition appears in multiple places. |
| G24 | **Follow Standard Conventions** — Coding standards enforced by code, not documents. | Follow Microsoft's C# coding conventions. Use `.editorconfig` to enforce. |
| G25 | **Replace Magic Numbers with Named Constants** — Applies to any non-self-describing token, not just numbers. | `if (status == 3)` → `if (status == OrderStatus.Shipped)`. Also applies to magic strings. |
| G26 | **Be Precise** — Don't be lazy about decisions. Check for null, handle concurrent updates, use proper types. | Don't use `float` for money. Don't assume a query returns one result. Use `decimal` for currency. |
| G27 | **Structure over Convention** — Enforce decisions with structure (abstract methods) over convention (naming rules). | An `abstract` base class forces implementation. A naming convention doesn't. |
| G28 | **Encapsulate Conditionals** — Extract complex boolean logic into named methods. | `if (ShouldBeDeleted(timer))` is clearer than `if (timer.HasExpired && !timer.IsRecurrent)`. |
| G29 | **Avoid Negative Conditionals** — Positives are easier to read. | `if (buffer.ShouldCompact())` > `if (!buffer.ShouldNotCompact())` |
| G30 | **Functions Should Do One Thing** — If a function has sections, it does more than one thing. Extract. | Loop + filter + process = three things. Use LINQ `.Where()` + separate processing method. |
| G31 | **Hidden Temporal Couplings** — Make execution order explicit through parameters (bucket brigade). | If `Initialize()` must be called before `Process()`, make `Process()` take the result of `Initialize()` as a parameter. |
| G32 | **Don't Be Arbitrary** — Have a reason for structure and communicate it. | Public nested classes should be justified. Don't nest classes for convenience. |
| G33 | **Encapsulate Boundary Conditions** — Put boundary processing in one place. No scattered `+1`s and `-1`s. | `var nextIndex = currentIndex + 1; if (nextIndex < items.Length)` |
| G34 | **Functions Should Descend Only One Level of Abstraction** — All statements at the same level. | Don't mix `html.Append("<hr")` with `if (size > 0)` business logic. Separate construction from formatting. |
| G35 | **Keep Configurable Data at High Levels** — Defaults and config values should live at the top, not buried in low-level code. | Use `IOptions<T>`, `appsettings.json`, or top-level constants. Not magic values deep in service methods. |
| G36 | **Avoid Transitive Navigation** — Law of Demeter. Don't chain: `a.GetB().GetC().DoSomething()`. | Ask immediate collaborators for services directly. Use mediator or facade patterns if needed. |

## Names

| Code | Smell | C# Notes |
|------|-------|----------|
| N1 | **Choose Descriptive Names** — Names are 90% of readability. Take time, keep them relevant. | `x()` → `CalculateBowlingScore()`. The power of good names overloads code with description. |
| N2 | **Choose Names at the Appropriate Level of Abstraction** — Don't encode implementation. | `IModem.Dial(phoneNumber)` → `IModem.Connect(connectionLocator)` if it's not always a phone. |
| N3 | **Use Standard Nomenclature Where Possible** — Use pattern names (Decorator, Factory, Repository), C# conventions (`ToString()`, `Dispose()`). | Follow the team's ubiquitous language (DDD). |
| N4 | **Unambiguous Names** — `DoRename()` containing `RenamePage()` is confusing. Be specific. | `RenamePageAndOptionallyAllReferences()` — long but clear from one call site. |
| N5 | **Use Long Names for Long Scopes** — `i` is fine in a 3-line loop. Use descriptive names for class-level scope. | Loop variable `i` = OK. Class field `i` = never OK. |
| N6 | **Avoid Encodings** — No Hungarian notation, no `m_` prefixes. Modern IDEs show types. | C# convention: `_camelCase` for private fields is acceptable. `strName`, `intCount` is not. |
| N7 | **Names Should Describe Side-Effects** — `GetOos()` that also creates = `CreateOrReturnOos()`. | `GetOrCreateConnection()` not `GetConnection()` if it creates on first call. |

## Tests

| Code | Smell | C# Notes |
|------|-------|----------|
| T1 | **Insufficient Tests** — Test everything that could break. "Seems enough" isn't a metric. | Use code coverage tools but don't target 100% blindly — focus on behavior coverage. |
| T2 | **Use a Coverage Tool!** — Find gaps in testing strategy. Visual indicators for covered/uncovered. | Rider, VS, coverlet, ReportGenerator. |
| T3 | **Don't Skip Trivial Tests** — Easy to write, high documentary value. | Even simple property mappings deserve a test if they're part of a contract. |
| T4 | **An Ignored Test Is a Question about an Ambiguity** — `[Ignore]` or `[Skip]` = unclear requirements. Document why. | `[Fact(Skip = "Awaiting clarification on timezone handling")]` |
| T5 | **Test Boundary Conditions** — Special care for edges. | Empty list, null, `int.MaxValue`, empty string, single-element collection. |
| T6 | **Exhaustively Test Near Bugs** — Bugs congregate. Finding one means more are nearby. | Found a bug in `CalculateDiscount()`? Test all discount scenarios thoroughly. |
| T7 | **Patterns of Failure Are Revealing** — Complete, ordered test cases expose patterns. | If all tests with input > 5 chars fail, that's a clue. |
| T8 | **Test Coverage Patterns Can Be Revealing** — Uncovered code gives clues about failures. | Green/red coverage report shows exactly which branches aren't tested. |
| T9 | **Tests Should Be Fast** — Slow tests don't get run. | Unit tests < 100ms each. Integration tests separated. Use `dotnet test --filter Category=Unit`. |

## Quick Reference: Top 10 for C# Daily Reviews

These are the smells you'll encounter most frequently in C# codebases:

1. **G5: Duplication** — Copy-paste code, repeated switch/case
2. **N1: Descriptive Names** — Cryptic variable names, vague method names
3. **G30: Functions Do One Thing** — Methods that loop + filter + transform + save
4. **F1: Too Many Arguments** — Methods with 5+ parameters
5. **G8: Too Much Information** — Everything is `public`, interfaces too large
6. **C5: Commented-Out Code** — Dead code that nobody deletes
7. **G25: Magic Numbers** — Hardcoded values without named constants
8. **G36: Transitive Navigation** — Long method chains (Law of Demeter violations)
9. **G11: Inconsistency** — Mixed conventions across the codebase
10. **T1: Insufficient Tests** — No tests or only happy-path tests
