# Clean Code Smells & Heuristics Checklist

This is the complete catalog from Chapter 17 of Clean Code, adapted for Python code review. Use these codes when identifying issues.

## Comments

| Code | Smell | Python Notes |
|------|-------|--------------|
| C1 | **Inappropriate Information** — Comment holds info that belongs in source control, issue tracker, or other systems (authors, change history, SPR numbers) | Remove `# Modified by X on Y` comments. Use Git blame instead. |
| C2 | **Obsolete Comment** — Comment is old, irrelevant, or incorrect. They migrate away from the code they described. | Delete or update immediately. Docstrings on private functions go stale fast. |
| C3 | **Redundant Comment** — Describes something the code already says clearly. `i += 1  # increment i` | Especially common with docstrings: `"""Returns the name."""` on a `name` property. |
| C4 | **Poorly Written Comment** — Worth writing = worth writing well. Use correct grammar, be brief, don't ramble. | Applies to `# TODO:` comments too — make them actionable. |
| C5 | **Commented-Out Code** — Rots over time, follows obsolete conventions. Delete it — source control remembers. | `# old_service = LegacyService()` — just delete it. |

## Environment

| Code | Smell | Python Notes |
|------|-------|--------------|
| E1 | **Build Requires More Than One Step** — Should be a single trivial operation. | `pytest`, `ruff check .`, or `mypy .` should be all you need. No manual venv activation or secret config steps. |
| E2 | **Tests Require More Than One Step** — Run all tests with one command. | `pytest` from the root. No database seeding or manual setup required. |

## Functions

| Code | Smell | Python Notes |
|------|-------|--------------|
| F1 | **Too Many Arguments** — Zero is best, then one, two, three. More than three is very questionable. | Use parameter objects, dataclasses, or `**kwargs` with care: `create_order(request: CreateOrderRequest)`. |
| F2 | **Output Arguments** — Counterintuitive. Readers expect inputs, not outputs. | Avoid mutating input objects as a way to "return" data. Return a new object or a tuple. Exception: in-place algorithms on mutable collections are idiomatic when documented. |
| F3 | **Flag Arguments** — Boolean args declare the function does more than one thing. | Split into two functions: instead of `render(is_suite: bool)`, use `render_for_suite()` and `render_for_single_test()`. |
| F4 | **Dead Function** — Never called. Delete it. Source control remembers. | Use your IDE or `vulture` to find unused functions before deleting. |

## General

| Code | Smell | Python Notes |
|------|-------|--------------|
| G1 | **Multiple Languages in One Source File** — Minimize extra languages. | Watch for SQL strings, JSON literals, HTML templates embedded in Python files. Use resource files, templates, or separate modules. |
| G2 | **Obvious Behavior Is Unimplemented** — The Principle of Least Surprise. Functions should do what their name implies. | `parse_day("Monday")` should handle `"monday"`, `"Mon"`, `"MONDAY"`. |
| G3 | **Incorrect Behavior at the Boundaries** — Don't trust intuition. Write tests for every boundary. | Off-by-one in slices `[start:end]`, empty collections, `None` inputs, single-element iterables. |
| G4 | **Overridden Safeties** — Don't suppress warnings, skip tests, or ignore analyzer rules without justification. | `# noqa`, `except Exception: pass`, `@pytest.mark.skip` without reason — all red flags. |
| G5 | **Duplication** — The most important rule. Every duplication is a missed abstraction opportunity. | Identical code → extract function. Similar if/elif → polymorphism or dispatch dict. Similar algorithms → Strategy or Template Method. |
| G6 | **Code at Wrong Level of Abstraction** — Higher-level concepts in base classes, details in derivatives. Separation must be complete. | A repository protocol shouldn't have raw SQL string constants. |
| G7 | **Base Classes Depending on Their Derivatives** — Base should know nothing about derivatives. | Base class referencing a derived type name = coupling violation. |
| G8 | **Too Much Information** — Well-defined modules have small interfaces. Hide data, hide utilities, keep coupling low. | Use `_private` names and `__all__`. Expose only what's needed. Prefer small protocols over large ones. |
| G9 | **Dead Code** — Unreachable `if` branches, empty `except` blocks, unused functions. Delete it. | `if False:`, unreachable code after `return`, unused `elif` branches. |
| G10 | **Vertical Separation** — Declare variables near first usage. Define private functions just below their first call. | Don't declare all variables at the top of the function. |
| G11 | **Inconsistency** — Do similar things the same way throughout. | If you use `response` in one function for an HTTP response, use it everywhere. If one module uses type hints, they all should. |
| G12 | **Clutter** — Unused variables, empty constructors, needless comments. Remove them. | Unused imports, empty `__init__` methods in dataclasses, default argument values that are never overridden. |
| G13 | **Artificial Coupling** — Don't put things together just because it's convenient. | A general-purpose `Enum` inside a specific class forces everyone to depend on that class. Move it to its own module. |
| G14 | **Feature Envy** — A method that uses too many members of another class. It wants to be in that other class. | `calculator.calculate(order.price, order.tax, order.discount)` → the calculation probably belongs in `Order`. |
| G15 | **Selector Arguments** — Boolean/enum args that select behavior. Split into separate methods. | `process_payment(payment_type)` → `process_credit_card()`, `process_bank_transfer()`. |
| G16 | **Obscured Intent** — Code should be expressive. No Hungarian notation, no cryptic abbreviations. | `m_ot_calc = i_ths_wkd * i_ths_rte` → unreadable. Spell it out. |
| G17 | **Misplaced Responsibility** — Code placed where convenient, not where intuitive. Follow Principle of Least Surprise. | Where should `calculate_total()` live? The class whose name implies that responsibility. |
| G18 | **Inappropriate Static** — If there's any chance you'll want polymorphism, make it non-static. | `PayCalculator.calculate(employee)` → should probably be `employee.calculate_pay()` or use dependency injection. |
| G19 | **Use Explanatory Variables** — Break complex expressions into named intermediates. | `is_eligible = age >= 18 and has_consent` is clearer than inlining the expression. |
| G20 | **Function Names Should Say What They Do** — `date.add(5)` adds what? Days? Hours? Use `add_days(5)`. | Python's `datetime` already follows this (`timedelta(days=5)`). Apply the same precision to your own APIs. |
| G21 | **Understand the Algorithm** — Don't just make it pass tests. Understand *why* it works, then refactor until it's obvious. | If you needed trial-and-error to make it work, refactor until the logic is self-evident. |
| G22 | **Make Logical Dependencies Physical** — Don't assume; explicitly ask for what you depend on. | Don't hardcode `PAGE_SIZE = 55` — inject it or ask the formatter for `max_page_size()`. |
| G23 | **Prefer Polymorphism to If/Else or Switch/Case** — ONE SWITCH rule: one dispatch per selection type, creating polymorphic objects. | In Python, use `match/case` for simple structural decomposition, but use polymorphism when the same condition appears in multiple places. |
| G24 | **Follow Standard Conventions** — Coding standards enforced by code, not documents. | Follow PEP 8. Use `ruff`, `black`, `mypy`, and `.pre-commit-config.yaml` to enforce. |
| G25 | **Replace Magic Numbers with Named Constants** — Applies to any non-self-describing token, not just numbers. | `if status == 3:` → `if status == OrderStatus.SHIPPED:`. Also applies to magic strings. |
| G26 | **Be Precise** — Don't be lazy about decisions. Check for null, handle concurrent updates, use proper types. | Don't use `float` for money. Don't assume a query returns one result. Use `Decimal` for currency. |
| G27 | **Structure over Convention** — Enforce decisions with structure (abstract methods) over convention (naming rules). | An `ABC` with `@abstractmethod` forces implementation. A naming convention doesn't. |
| G28 | **Encapsulate Conditionals** — Extract complex boolean logic into named methods. | `if should_be_deleted(timer):` is clearer than `if timer.has_expired and not timer.is_recurrent:`. |
| G29 | **Avoid Negative Conditionals** — Positives are easier to read. | `if buffer.should_compact():` > `if not buffer.should_not_compact():` |
| G30 | **Functions Should Do One Thing** — If a function has sections, it does more than one thing. Extract. | Loop + filter + process = three things. Use comprehensions or generator pipelines. |
| G31 | **Hidden Temporal Couplings** — Make execution order explicit through parameters (bucket brigade). | If `initialize()` must be called before `process()`, make `process()` take the result of `initialize()` as a parameter. |
| G32 | **Don't Be Arbitrary** — Have a reason for structure and communicate it. | Public nested classes should be justified. Don't nest classes for convenience. |
| G33 | **Encapsulate Boundary Conditions** — Put boundary processing in one place. No scattered `+1`s and `-1`s. | `next_index = current_index + 1; if next_index < len(items):` |
| G34 | **Functions Should Descend Only One Level of Abstraction** — All statements at the same level. | Don't mix HTML string concatenation with business logic. Separate construction from formatting. |
| G35 | **Keep Configurable Data at High Levels** — Defaults and config values should live at the top, not buried in low-level code. | Use module-level constants, `pydantic-settings`, or environment variables. Not magic values deep in service functions. |
| G36 | **Avoid Transitive Navigation** — Law of Demeter. Don't chain: `a.get_b().get_c().do_something()`. | Ask immediate collaborators for services directly. Use mediator or facade patterns if needed. |

## Names

| Code | Smell | Python Notes |
|------|-------|--------------|
| N1 | **Choose Descriptive Names** — Names are 90% of readability. Take time, keep them relevant. | `x()` → `calculate_bowling_score()`. The power of good names overloads code with description. |
| N2 | **Choose Names at the Appropriate Level of Abstraction** — Don't encode implementation. | `Modem.dial(phone_number)` → `Modem.connect(connection_locator)` if it's not always a phone. |
| N3 | **Use Standard Nomenclature Where Possible** — Use pattern names (Decorator, Factory, Repository), Python conventions (`__str__`, `__iter__`, `__eq__`). | Follow the team's ubiquitous language (DDD). |
| N4 | **Unambiguous Names** — `do_rename()` containing `rename_page()` is confusing. Be specific. | `rename_page_and_optionally_all_references()` — long but clear from one call site. |
| N5 | **Use Long Names for Long Scopes** — `i` is fine in a 3-line loop. Use descriptive names for module-level scope. | Loop variable `i` = OK. Module-level variable `i` = never OK. |
| N6 | **Avoid Encodings** — No Hungarian notation, no `m_` prefixes. Modern IDEs show types. | Python convention: `_leading_underscore` for internal names. `str_name`, `int_count` is not. |
| N7 | **Names Should Describe Side-Effects** — `get_oos()` that also creates = `create_or_return_oos()`. | `get_or_create_connection()` not `get_connection()` if it creates on first call. |

## Tests

| Code | Smell | Python Notes |
|------|-------|--------------|
| T1 | **Insufficient Tests** — Test everything that could break. "Seems enough" isn't a metric. | Use code coverage tools but don't target 100% blindly — focus on behavior coverage. |
| T2 | **Use a Coverage Tool!** — Find gaps in testing strategy. Visual indicators for covered/uncovered. | `pytest-cov`, `coverage.py`. |
| T3 | **Don't Skip Trivial Tests** — Easy to write, high documentary value. | Even simple property mappings deserve a test if they're part of a contract. |
| T4 | **An Ignored Test Is a Question about an Ambiguity** — `@pytest.mark.skip` = unclear requirements. Document why. | `@pytest.mark.skip(reason="Awaiting clarification on timezone handling")` |
| T5 | **Test Boundary Conditions** — Special care for edges. | Empty list, `None`, `sys.maxsize`, empty string, single-element collection. |
| T6 | **Exhaustively Test Near Bugs** — Bugs congregate. Finding one means more are nearby. | Found a bug in `calculate_discount()`? Test all discount scenarios thoroughly. |
| T7 | **Patterns of Failure Are Revealing** — Complete, ordered test cases expose patterns. | If all tests with input > 5 chars fail, that's a clue. |
| T8 | **Test Coverage Patterns Can Be Revealing** — Uncovered code gives clues about failures. | Green/red coverage report shows exactly which branches aren't tested. |
| T9 | **Tests Should Be Fast** — Slow tests don't get run. | Unit tests < 100ms each. Integration tests separated. Use `pytest -m unit`. |

## Quick Reference: Top 10 for Python Daily Reviews

These are the smells you'll encounter most frequently in Python codebases:

1. **G5: Duplication** — Copy-paste code, repeated if/elif
2. **N1: Descriptive Names** — Cryptic variable names, vague function names
3. **G30: Functions Do One Thing** — Functions that loop + filter + transform + save
4. **F1: Too Many Arguments** — Functions with 5+ parameters
5. **G8: Too Much Information** — Everything is public, interfaces too large
6. **C5: Commented-Out Code** — Dead code that nobody deletes
7. **G25: Magic Numbers** — Hardcoded values without named constants
8. **G36: Transitive Navigation** — Long method chains (Law of Demeter violations)
9. **G11: Inconsistency** — Mixed conventions across the codebase
10. **T1: Insufficient Tests** — No tests or only happy-path tests
