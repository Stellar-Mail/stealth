# Task Extractor — Testing Guide

Comprehensive testing documentation for the Task Extractor tool.

## Table of Contents

- [Running Tests](#running-tests)
- [Test Structure](#test-structure)
- [Test Coverage](#test-coverage)
- [Writing New Tests](#writing-new-tests)
- [Test Fixtures](#test-fixtures)
- [Continuous Integration](#continuous-integration)

## Running Tests

### Run All Tests

From the repository root:

```sh
npx vitest run --config tools/v2/individual/task-extractor/vitest.config.ts
```

### Watch Mode

For development with auto-rerun on file changes:

```sh
npx vitest watch --config tools/v2/individual/task-extractor/vitest.config.ts
```

### Run Specific Test File

```sh
npx vitest run tools/v2/individual/task-extractor/tests/taskExtractor.test.ts
```

### Run Tests with Coverage

```sh
npx vitest run --coverage --config tools/v2/individual/task-extractor/vitest.config.ts
```

## Test Structure

The test suite is organized into four main files:

### 1. `taskExtractor.test.ts`

Tests the core extraction engine (`extractTasks` function):

- **Fixture-based tests**: Validates all success fixtures produce expected output
- **Rule matching**: Tests checkbox, request-phrase, bullet-action, and imperative-line triggers
- **Confidence levels**: Validates high/medium/low confidence assignment
- **Priority detection**: Tests urgent, normal, and low priority inference
- **Date parsing**: Tests ISO dates and relative phrases (today, tomorrow, eod)
- **Deduplication**: Tests case-insensitive task deduplication
- **Truncation**: Tests maxTasks limit enforcement
- **Options**: Tests minConfidence filtering and maxTasks resolution
- **Determinism**: Validates identical input produces identical output
- **Immutability**: Ensures input objects are never mutated

### 2. `guards.test.ts`

Tests the validation and sanitization layer (`guards` service):

- **Input validation**: Tests structural validation of `TaskExtractionInput`
- **Options validation**: Tests validation of `TaskExtractionOptions`
- **Limit checks**: Tests enforcement of character and word count limits
- **Sanitization**: Tests NFC normalization and control character removal
- **Safe entry point**: Tests `safeExtractTasks` error handling
- **Fixture validation**: Runs all success and failure fixtures
- **Error codes**: Validates each error path returns correct error code
- **Hostile payloads**: Tests resilience against malformed input

### 3. `fixtures.test.ts`

Tests the fixture system itself:

- **Fixture structure**: Validates all fixtures match their TypeScript interfaces
- **Success paths**: Ensures all success fixtures produce `ok` status
- **Failure paths**: Ensures all failure fixtures produce `error` status
- **Error code coverage**: Validates all error codes have fixture coverage
- **Trigger coverage**: Validates all task triggers have fixture coverage
- **Confidence coverage**: Validates all confidence levels have fixture coverage
- **Priority coverage**: Validates all priority levels have fixture coverage
- **Uniqueness**: Ensures all fixture names are unique

### 4. `edge-cases.test.ts`

Tests edge cases and boundary conditions:

- **Text processing**: Unicode, emoji, long text, whitespace handling
- **Date and time**: Leap years, month boundaries, invalid dates, relative phrases
- **Priority detection**: Case variations, context detection, compound phrases
- **Task extraction**: Checkbox variations, numbered lists, case sensitivity
- **Options and limits**: Boundary values for maxTasks and minConfidence
- **Sanitization**: Control characters, zero-width characters, NFC normalization
- **Deduplication**: Exact matches, case-insensitive, post-normalization
- **IDs and metadata**: Sequential IDs, messageId echo, stability

## Test Coverage

### Core Functionality

✅ **Extraction Rules**

- Checkbox pattern (`- [ ]`)
- Request phrases ("please", "could you", etc.)
- Bullet + action verb
- Imperative lines

✅ **Confidence Levels**

- High: checkbox, request-phrase
- Medium: bullet-action
- Low: imperative-line

✅ **Priority Detection**

- High: urgent, asap, critical, blocking, etc.
- Low: no rush, whenever you can, etc.
- Normal: default

✅ **Date Parsing**

- ISO 8601 dates (YYYY-MM-DD)
- Relative phrases: today, tomorrow, eod, eow
- Weekday names (stored as text hints)
- Calendar validation (rejects impossible dates)

### Validation & Sanitization

✅ **Input Validation**

- Type checking
- Required fields
- Optional fields
- Size limits (messageId: 256, subject: 500, body: 50k chars / 10k words)

✅ **Options Validation**

- maxTasks: 1-50
- minConfidence: low/medium/high

✅ **Sanitization**

- NFC normalization
- Control character removal
- Zero-width character removal
- Whitespace collapsing

### Error Handling

✅ **All Error Codes**

- `invalid-input`: Missing/wrong type fields
- `invalid-options`: Out-of-range options
- `input-too-large`: Exceeds size limits
- `empty-content`: Nothing to analyze after sanitization
- `unsupported-language`: Non-English language tag

### Edge Cases

✅ **Robustness**

- Empty input (subject or body)
- Very long text (>200 chars)
- Unicode emoji and special characters
- Mixed line endings (CRLF/LF)
- Multiple consecutive whitespace
- Hostile/malformed payloads

✅ **Determinism**

- Identical input → identical output
- No mutation of input objects
- No randomness
- No clock reads (unless receivedAt provided)

## Writing New Tests

### Test Template

```typescript
import { describe, expect, it } from "vitest";
import { extractTasks } from "../services/taskExtractor";
import type { TaskExtractionInput } from "../types/taskExtractor";

describe("Feature Name", () => {
  it("describes expected behavior", () => {
    const input: TaskExtractionInput = {
      messageId: "test-001",
      subject: "",
      body: "Test content here",
    };

    const result = extractTasks(input);

    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].text).toBe("expected text");
    expect(result.tasks[0].confidence).toBe("high");
  });
});
```

### Best Practices

1. **Use descriptive test names**: Name should explain what is being tested
2. **Test one thing**: Each test should validate a single behavior
3. **Use fixtures**: Leverage existing fixtures when possible
4. **Test edge cases**: Include boundary conditions and unusual input
5. **Validate immutability**: Ensure input objects aren't mutated
6. **Check all fields**: Validate the complete output structure
7. **Use type safety**: Prefer typed inputs over `any`

### Adding New Fixtures

To add a new success fixture:

```typescript
// In services/fixtures.ts
export const successFixtures: SuccessFixture[] = [
  // ... existing fixtures
  {
    name: "your-fixture-name",
    input: {
      messageId: "msg-yourtest-001",
      subject: "Subject line",
      body: "Body content with tasks",
      receivedAt: "2026-07-01T10:00:00.000Z",
    },
    expectedTaskTexts: ["first expected task", "second expected task"],
  },
];
```

To add a new failure fixture:

```typescript
// In services/fixtures.ts
export const failureFixtures: FailureFixture[] = [
  // ... existing fixtures
  {
    name: "your-failure-case",
    input: {
      messageId: "test",
      // Intentionally malformed for testing
      subject: 123, // wrong type
      body: "test",
    },
    expectedCode: "invalid-input",
  },
];
```

## Test Fixtures

### Success Fixtures

Located in `services/fixtures.ts`:

- **explicit-requests**: Request phrases ("please", "could you")
- **checkbox-and-bullet-list**: Mixed checkbox and bullet formats
- **urgent-request-with-relative-due**: Priority + relative dates
- **no-tasks-found**: Valid input with no extractable tasks

### Failure Fixtures

Each triggers a specific error code:

- **missing-body**: Tests `invalid-input` for structural issues
- **blank-message-id**: Tests `invalid-input` for required fields
- **oversized-body**: Tests `input-too-large` for size limits
- **empty-content**: Tests `empty-content` after sanitization
- **unsupported-language**: Tests `unsupported-language` for non-English

## Continuous Integration

### Pre-commit Checks

Before committing changes, run:

```sh
# Run all tests
npm test

# Run linter
npm run lint

# Run type checker
npx tsc --noEmit
```

### CI Pipeline

The CI pipeline should run:

1. **Unit tests**: All vitest tests
2. **Linting**: ESLint checks
3. **Type checking**: TypeScript compilation
4. **Build verification**: Ensure no build errors

### Coverage Requirements

- **Line coverage**: Aim for >95%
- **Branch coverage**: Aim for >90%
- **Function coverage**: Aim for 100%
- **Statement coverage**: Aim for >95%

## Debugging Tests

### Verbose Output

```sh
npx vitest run --reporter=verbose
```

### Debug Single Test

Add `.only` to focus on a single test:

```typescript
it.only("should test this specific case", () => {
  // Your test
});
```

### Inspect Test Output

Use `console.log` or `console.dir` to inspect values:

```typescript
it("debugs output", () => {
  const result = extractTasks(input);
  console.dir(result, { depth: null });
  expect(result.tasks).toHaveLength(1);
});
```

### Skip Failing Tests

Temporarily skip tests with `.skip`:

```typescript
it.skip("temporarily disabled", () => {
  // Test code
});
```

## Known Testing Limitations

1. **No UI tests**: This tool has no UI component; all tests are unit tests
2. **No integration tests**: Tool is isolated; no database or external services
3. **English only**: Tests only cover English language input
4. **Date resolution**: Relative dates require `receivedAt`; no system clock access
5. **No network**: No external API calls; all processing is local

## Contributing Tests

When adding new features:

1. Add tests for the new behavior
2. Update fixtures if needed
3. Run all tests to ensure no regressions
4. Update this documentation if test structure changes
5. Ensure CI passes before submitting PR

For questions about testing, see [CONTRIBUTING.md](./CONTRIBUTING.md).
