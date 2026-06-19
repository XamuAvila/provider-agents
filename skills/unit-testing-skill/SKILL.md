---
name: unit-testing
description: "Guide for writing high-quality unit tests based on 'The Art of Unit Testing' by Roy Osherove. Use this skill whenever the user asks about writing unit tests, test organization, mocking/stubbing patterns, test naming conventions, making code testable, working with legacy code, TDD practices, or reviewing test quality. Trigger on phrases like: 'write tests for', 'unit test', 'mock', 'stub', 'fake', 'test doubles', 'test naming', 'test organization', 'isolation framework', 'testability', 'legacy code testing', 'trustworthy tests', 'maintainable tests', 'readable tests', 'test review', 'code coverage', 'NUnit', 'xUnit', 'NSubstitute', 'Moq', 'Jest', 'test hierarchy'. Also trigger when the user shares code and asks for test suggestions, or when reviewing existing tests for quality."
---

# Unit Testing Skill

Based on principles from "The Art of Unit Testing" by Roy Osherove. This skill provides guidance for writing trustworthy, maintainable, and readable unit tests.

## Core Definitions

### Unit of Work
A unit of work is the sum of actions between invoking a public method and a single noticeable end result. It can span a single method up to multiple classes. A noticeable end result is one of:
1. **Return value** — the method returns something (function, not void)
2. **State change** — observable change in system behavior without inspecting private state
3. **Third-party call** — callout to external dependency with no return value you use

### Good Unit Test Properties
A unit test is automated, invokes a unit of work, checks an end result, is easy to write, runs quickly, and is consistent and reliable. If it doesn't meet ALL of these, it's likely an integration test.

### Three Types of Test Results
1. **Value-based testing** — check the returned value
2. **State-based testing** — check the changed state of the system
3. **Interaction testing** — check that a call was made to a third-party dependency

Prefer value-based > state-based > interaction testing (in that order).

---

## The Three Pillars of Good Unit Tests

Every test must be evaluated against these three pillars. Drop any one and you risk wasting everyone's time.

### 1. Trustworthiness
- Tests pass? You trust the code works. Tests fail? You trust there's a real bug.
- **Avoid logic in tests** — no if, switch, for, while, or try-catch in test code
- **Test only one concern per test** — one logical concept, not necessarily one assert
- **Separate unit from integration tests** — run unit tests on every build, integration tests less frequently
- **When to remove/change tests**: production bugs (fix code, not test), test bugs (fix test, verify it fails/passes correctly), API changes (update test setup, use factory methods), conflicting requirements (replace test)

### 2. Maintainability
- **Don't test private methods** — test through the public API; if you feel the need, extract to a new class
- **Remove duplication** — use factory methods, helper classes, setup methods
- **Enforce test isolation** — tests must not depend on each other or share state
- **Avoid multiple asserts on different concerns** — split into separate tests
- **Avoid overspecification** — don't verify internal implementation details; test outcomes, not how they're achieved

### 3. Readability
- **Naming convention**: `[UnitOfWork]_[Scenario]_[ExpectedBehavior]` — examples:
  - `IsValid_WhenEmptyFileName_ReturnsFalse`
  - `Add_NegativeNumbers_ThrowsException`
  - `Calculate_SimplyWorks_ReturnsExpectedSum`
- **Variable naming**: avoid generic names; use `stubLogger`, `fakeRepository`, `mockEmailService`
- **Separate assert from action**: assign result to a variable, then assert on it
- **Use meaningful asserts**: include failure messages; prefer fluent assertions

---

## Test Doubles: Stubs, Mocks, and Fakes

### Definitions
- **Stub** — a controllable replacement that returns predefined values. You DON'T assert against a stub.
- **Mock** — a fake object you VERIFY was called correctly. You assert against a mock.
- **Fake** — generic term for any object that replaces a real dependency (stubs and mocks are both fakes).

### Critical Rule: One Mock Per Test
- A test should have AT MOST one mock object
- You can have multiple stubs in a test
- If you find yourself needing multiple mocks, you're testing multiple concerns — split the test

### Dependency Injection Patterns (for making code testable)
1. **Constructor injection** — inject dependency via constructor parameter
2. **Property injection** — set dependency via public property
3. **Method-level injection** — pass dependency as method parameter
4. **Extract and Override** — create a virtual method that returns the dependency; override in test subclass
5. **Factory pattern** — use a factory that can be replaced in tests

---

## Isolation (Mocking) Frameworks

### When to Use
- Use isolation frameworks to create stubs and mocks dynamically instead of handwriting them
- Frameworks: NSubstitute, Moq, FakeItEasy (.NET) / Jest mocks, Sinon (JS/TS) / Mockito (Java)

### Best Practices
- **Recursive fakes** — fakes that return fakes for chained calls
- **Nonstrict behavior** — fakes should return default values for unconfigured calls (don't throw)
- **Avoid record-and-replay** — prefer Arrange-Act-Assert (AAA) style

### Antipatterns to Avoid
- **Overspecification** — verifying exact call order, exact parameter values when not relevant
- **Testing implementation** — asserting internal method calls instead of observable outcomes
- **Concept confusion** — using the same object as both mock and stub

---

## Test Organization

### Project Structure
```
MyProject/
MyProject.Tests.Unit/        # Fast, isolated, run on every build
MyProject.Tests.Integration/  # Slower, may touch DB/API, run less frequently
```

### Test Class Mapping
- One test class per class under test (at minimum)
- For complex classes, one test class per unit of work / method entry point
- Name: `[ClassName]Tests` — e.g., `LogAnalyzerTests`

### Test Hierarchy Patterns
- **Base test class** — share common setup/tests across related test classes
- **Template test pattern** — abstract base with abstract factory method; derived classes provide concrete implementation
- **Helper/utility classes** — factory methods, custom assert methods, configuration helpers

### Build Integration
- All unit tests run on every build (CI/CD)
- Fail the build if any unit test fails
- Integration tests run on a separate schedule (nightly or on demand)
- Keep a "safe green zone" — all unit tests must pass at all times

---

## Working with Legacy Code

### Where to Start
- **Easy-first strategy** — start with simple, low-dependency code to build confidence and skill
- **Hard-first strategy** — start with the most critical/complex code for maximum value
- Recommendation: start easy, but move to critical code once comfortable

### Approach
1. Write integration tests around the legacy code as a safety net
2. Refactor to introduce seams (injection points)
3. Write unit tests for the refactored code
4. Repeat incrementally

### Key Tools for Legacy Code
- Unconstrained isolation frameworks (can mock sealed classes, static methods, non-virtual methods)
- Acceptance tests before refactoring
- Dependency analysis tools (NDepend, SonarQube)

---

## Design for Testability

### Design Guidelines
- Use interface-based designs (depend on abstractions, not concretions)
- Avoid instantiating concrete classes inside methods that contain logic
- Avoid direct calls to static methods that have side effects
- Avoid constructors that do logic (keep them simple)
- Separate singleton logic from singleton holders

### The Trade-offs
- Testable design sometimes means more interfaces, more indirection
- The benefit: each class has a single responsibility and can be tested independently
- In dynamic languages (JS/TS, Python), testability is easier — you can replace anything at runtime

---

## Quick Reference: Writing a Test

```
// Arrange — set up the test
// Act — invoke the unit of work
// Assert — check the end result

[Test]
public void UnitOfWork_Scenario_ExpectedBehavior()
{
    // Arrange
    var stub = Substitute.For<IDependency>();
    stub.GetValue().Returns("expected");
    var sut = new MyClass(stub);

    // Act
    var result = sut.DoSomething();

    // Assert
    Assert.AreEqual("expected-output", result);
}
```

### Checklist Before Committing a Test
- [ ] Does it follow the naming convention?
- [ ] Is there only one logical concern being tested?
- [ ] Would I trust this test if it fails?
- [ ] Can I understand what it tests in 30 seconds?
- [ ] Does it run fast (< 1 second)?
- [ ] Is it isolated from other tests?
- [ ] Does it avoid testing implementation details?

---

## For Deeper Reference

If you need detailed examples, patterns, or advanced topics, read the reference file at:
`references/key-patterns.md`

Topics covered in the reference:
- Detailed examples of stubs, mocks, and fakes in C# and TypeScript
- Complete test naming examples across different scenarios
- Factory method patterns for test setup
- Interaction testing patterns with verification
- Anti-patterns gallery with before/after examples
- Integration test vs unit test decision matrix
