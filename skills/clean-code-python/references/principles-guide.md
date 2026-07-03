# Clean Code Principles Guide for Python

Deep-dive reference on the core principles from Clean Code, adapted for Python.

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

```python
# Bad
d = 0  # elapsed time in days

# Good
elapsed_time_in_days = 0
days_since_creation = 0
file_age_in_days = 0
```

### Avoid Disinformation

Don't use names that mean something different to programmers. Don't use `account_list` unless it's actually a `list`. Consider `accounts` or `account_group`.

Don't use names that vary in tiny ways: `XYZControllerForEfficientHandlingOfStrings` vs `XYZControllerForEfficientStorageOfStrings`.

### Make Meaningful Distinctions

If names must differ, make the distinction meaningful. Number-series naming (`a1`, `a2`) and noise words (`ProductInfo` vs `ProductData`) are non-informative.

```python
# Bad — what's the difference?
def copy_chars(a1: list[str], a2: list[str]) -> None: ...

# Good
def copy_chars(source: list[str], destination: list[str]) -> None: ...
```

### Use Pronounceable and Searchable Names

If you can't pronounce it, you can't discuss it. If it's a single letter, you can't search for it.

```python
# Bad
from datetime import datetime
genymdhms: datetime  # generation year, month, day, hour, minute, second

# Good
generation_timestamp: datetime
```

Single-letter names are only acceptable as loop counters in very short functions.

### Class Names and Method Names

- **Classes** → Nouns or noun phrases: `Customer`, `WikiPage`, `Account`, `AddressParser`
- **Functions/Methods** → Verbs or verb phrases: `post_payment()`, `delete_page()`, `save()`
- **Properties** → Use `@property`, not `get_x()` / `set_x()`
- **Factory functions** → Name describes what's created: `complex_from_real_number(23.0)`

### Don't Be Cute / Pick One Word per Concept

`kill()` vs `abort()` vs `terminate()` — pick one and use it consistently. If you use `get` in some modules and `fetch` in others, readers waste time wondering if there's a difference.

### Solution vs Problem Domain Names

Use CS terms when the pattern is well-known (`Visitor`, `Queue`, `JobQueue`). Use business domain terms when there's no CS equivalent (`AccountingLedger`, `FlightItinerary`).

---

## Functions

### Small!

Functions should be small. Then smaller. Rarely more than 20 lines. Ideally 5-10 lines.

Blocks inside `if`, `else`, and `while` should be one line — typically a function call. This keeps the enclosing function small and adds documentary value since the called function has a descriptive name.

```python
# Clean — each block is a single function call
async def render_page_with_setups_and_teardowns(page_data: PageData, is_suite: bool) -> Markup:
    if is_test_page(page_data):
        await include_setup_and_teardown_pages(page_data, is_suite)
    return page_data.get_html()
```

### Do One Thing

A function should do one thing, do it well, and do it only. If you can extract a function from it with a name that's not a restatement of its implementation, it does more than one thing.

### One Level of Abstraction per Function (Stepdown Rule)

Read code top to bottom. Each function should introduce the next level of abstraction:

```python
# High level
async def process_order(order: Order) -> None:
    validate_order(order)
    payment = await charge_customer(order)
    await fulfill_order(order, payment)
    await notify_customer(order)

# One level down
def validate_order(order: Order) -> None:
    ensure_items_in_stock(order.items)
    ensure_valid_shipping_address(order.shipping_address)
    ensure_payment_method_active(order.payment_method)
```

### Function Arguments

- **Zero (niladic)**: Best. `get_current_time()`
- **One (monadic)**: Good. Asking a question (`file_exists(path: str) -> bool`) or transforming (`open_file(path: str) -> IO`) or event (`password_attempt_failed(attempts: int)`)
- **Two (dyadic)**: OK when natural ordering exists (`Point(x, y)`)
- **Three (triadic)**: Think very carefully
- **More**: Wrap into an object: `Circle(center, radius)` instead of `make_circle(x, y, radius)`

In Python, use **dataclasses** or **parameter objects** to reduce argument count:

```python
from dataclasses import dataclass

# Before: 5 args
def create_user(name: str, email: str, role: str, dept_id: int, active: bool) -> User: ...

# After: 1 arg (dataclass)
@dataclass
class CreateUserRequest:
    name: str
    email: str
    role: str
    department_id: int
    is_active: bool

def create_user(request: CreateUserRequest) -> User: ...
```

### No Side Effects

A function called `check_password()` should only check the password — not also initialize a session. Side effects are hidden lies.

### Command Query Separation

A function should either **do something** (command) or **answer something** (query), not both.

```python
# Bad — does it set the attribute or check if it exists?
if set("username", "unclebob"): ...

# Good — separated
if attribute_exists("username"):
    set_attribute("username", "unclebob")
```

### Prefer Exceptions to Error Codes

Error codes force nested `if` statements. Exceptions let you separate the happy path from error handling.

```python
# Bad
if delete_page(page) == E_OK:
    if registry.delete_reference(page.name) == E_OK: ...
    else:
        logger.log("delete_reference failed")

# Good
try:
    delete_page(page)
    registry.delete_reference(page.name)
    config_keys.delete_key(page.name.make_key())
except DeleteError as exc:
    logger.log(exc)
```

Extract try/except bodies into functions — error handling IS one thing:

```python
def delete(page: Page) -> None:
    try:
        delete_page_and_all_references(page)
    except DeleteError as exc:
        log_error(exc)

def delete_page_and_all_references(page: Page) -> None: ...
def log_error(exc: DeleteError) -> None: ...
```

---

## Comments

### The Best Comment Is No Comment

Code should express itself. Before writing a comment, try to express the same thing in code:

```python
# Bad
# Check to see if the employee is eligible for full benefits
if employee.flags.hourly_taker and employee.age > 65: ...

# Good
if employee.is_eligible_for_full_benefits(): ...
```

### Good Comments

- **Legal comments**: Copyright headers (keep brief, reference license file)
- **Explanation of intent**: Why a decision was made, not what the code does
- **Clarification**: When the meaning of an opaque API argument isn't clear
- **Warning of consequences**: `# Don't run unless you have 8 hours to spare`
- **TODO comments**: Mark future work, but clean them up regularly
- **Docstrings on public APIs**: Necessary for shared libraries and packages

### Bad Comments

- **Redundant**: Docstring that just restates the function signature
- **Misleading**: Comments that don't match what the code actually does
- **Mandated**: Docstring on every private function regardless of need
- **Journal**: `# 2024-01-15: Fixed bug` — that's what Git is for
- **Noise**: `# Default constructor` on a dataclass
- **Closing brace**: `# end while` — make the function shorter instead
- **Commented-out code**: Delete it. Always.

---

## Formatting

### Vertical Formatting

- **Small files**: 200-500 lines is ideal. Files over 500 lines deserve scrutiny.
- **Newspaper metaphor**: Name at the top should tell the story. Detail increases downward.
- **Vertical openness**: Blank lines between concepts (between functions, between logical sections).
- **Vertical density**: Related lines should stay close. Don't separate related declarations with blank lines.
- **Vertical distance**: Declare variables near usage. Keep related functions close. Callers above callees.

### Horizontal Formatting

- Lines under 100 characters (Black defaults to 88; many teams use 100 or 120).
- Use horizontal whitespace to associate related things and disassociate unrelated things:
  ```python
  total = price * quantity + tax  # spaces around + but tight around *
  ```
- **Don't align declarations** in columns — it draws attention to the wrong thing.

### Team Rules

The team picks one set of rules and everyone follows them. Use `pyproject.toml` in Python:

```toml
[tool.black]
line-length = 88

[tool.ruff]
line-length = 88
select = ["E", "F", "I", "N", "W"]

[tool.mypy]
strict = true
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

```python
# Bad — train wreck
output_dir = context.get_options().get_scratch_dir().get_absolute_path()

# Good
output_dir = context.get_scratch_directory_path()
```

### DTOs and Dataclasses

Data Transfer Objects are pure data structures — no business logic. In Python, use dataclasses:

```python
from dataclasses import dataclass
from datetime import date

@dataclass(frozen=True)
class OrderDto:
    id: int
    customer_name: str
    total: float
    order_date: date
```

**Active Records** (DTOs + navigation methods like save/find) are a common anti-pattern. Separate your domain model from your persistence mechanism.

---

## Error Handling

### Use Exceptions, Not Return Codes

Exceptions separate error handling from business logic. Return codes force interleaving.

### Write Try-Except-Else-Finally First

When writing a function that might raise, start with the `try-except-else-finally` structure. This helps define the scope and expectations.

### Provide Context with Exceptions

Include enough info to determine the source and nature of the error:

```python
# Bad
raise Exception("Error")

# Good
raise PaymentGatewayError(
    f"Failed to connect to payment gateway '{gateway_url}' "
    f"for order {order_id}. Timeout after {timeout_ms}ms."
)
```

### Define Exceptions by Caller's Needs

Wrap third-party APIs so you can raise your own exceptions:

```python
class PaymentGateway:
    def __init__(self, client: StripeClient) -> None:
        self._client = client

    async def charge(self, request: PaymentRequest) -> PaymentResult:
        try:
            return await self._client.charge(request.to_stripe_request())
        except StripeRateLimitError as exc:
            raise PaymentTemporarilyUnavailableError from exc
        except StripeAuthError as exc:
            raise PaymentConfigurationError from exc
        except StripeError as exc:
            raise PaymentFailedError from exc
```

### Don't Return None / Don't Pass None

Returning `None` forces null checks everywhere. Consider:

```python
from typing import overload

# Instead of returning None
def get_employees() -> list[Employee]:
    # Return empty list, not None
    return list(_employees)

# Make intent clear with type hints
def find_by_id(employee_id: int) -> Employee | None: ...
```

Use the **Special Case / Null Object pattern** when appropriate:

```python
from typing import Protocol

class MealPlan(Protocol):
    def get_meals(self) -> list[Meal]: ...

class NullMealPlan:
    def get_meals(self) -> list[Meal]:
        return []
```

---

## Boundaries

### Wrapping Third-Party APIs

Don't let third-party APIs leak into your codebase. Wrap them:

- Easier to mock for tests
- Minimizes migration cost when you switch libraries
- You control your API's shape

```python
class LoggerAdapter:
    def __init__(self, structlog_logger) -> None:
        self._logger = structlog_logger

    def info(self, message: str) -> None:
        self._logger.info(message)

    def error(self, message: str, exc: Exception | None = None) -> None:
        self._logger.error(message, exc_info=exc)
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

```python
# Bad — testing 3 concepts
def test_misc_stuff():
    # Test sorting
    # Test filtering
    # Test pagination
    ...

# Good — one concept each
def test_sorts_by_price_ascending_by_default() -> None: ...
def test_filters_out_of_stock_items() -> None: ...
def test_returns_requested_page_size() -> None: ...
```

### F.I.R.S.T. Principles

- **Fast**: Tests run quickly so you run them frequently
- **Independent**: Tests don't depend on each other's state
- **Repeatable**: Run in any environment (dev, CI, offline)
- **Self-Validating**: Boolean output — pass or fail, no manual inspection
- **Timely**: Written just before or alongside production code

### Domain-Specific Testing Language

Build helper functions that make tests read like specifications:

```python
def test_delinquent_account_receives_warning_email() -> None:
    account = (
        an_account()
        .with_balance(-100)
        .past_due_since(days_ago(30))
        .build()
    )

    service.process_delinquent(account)

    assert_warning_email_was_sent_to(account.email)
```

---

## Classes

### Classes Should Be Small (SRP)

A class should have **one reason to change**. If you can't describe its purpose in about 25 words without using "and" or "or", it likely has too many responsibilities.

```python
# Bad — too many reasons to change
class Employee:
    def calculate_pay(self) -> Decimal: ...
    def save(self) -> None: ...
    def generate_report(self) -> str: ...

# Good — each class has one responsibility
class Employee: ...  # domain data and behavior
class EmployeeRepository:
    def save(self, employee: Employee) -> None: ...
class EmployeeReportGenerator:
    def generate(self, employee: Employee) -> str: ...
```

### Cohesion

A class is maximally cohesive when each method uses every instance variable. When cohesion drops, consider splitting the class.

### Organizing for Change (OCP)

Classes should be open for extension, closed for modification. When new requirements come, you should be adding new classes, not modifying existing ones.

```python
from abc import ABC, abstractmethod

# Follows OCP — new SQL types = new class, no existing class changes
class SqlStatement(ABC):
    @abstractmethod
    def generate(self) -> str: ...

class SelectStatement(SqlStatement):
    def generate(self) -> str: ...

class InsertStatement(SqlStatement):
    def generate(self) -> str: ...

# Adding UPDATE? Just create UpdateStatement. No existing code changes.
```

---

## Emergence

Kent Beck's **Four Rules of Simple Design** (in priority order):

1. **Runs all the tests** — A system that can't be verified isn't verifiable. Design for testability (DI, protocols, small classes) leads to better design.
2. **Contains no duplication** — After tests pass, refactor to eliminate duplication. Every duplicate is a missed abstraction.
3. **Expresses the intent of the programmer** — Choose good names, keep things small, use standard patterns. The clearer the code, the less time others spend understanding it.
4. **Minimizes the number of classes and methods** — Don't create abstractions just for the sake of it. Pragmatism over dogma. But this is the *lowest priority* rule.
