# Task Extractor — Contributor Guide

Welcome! This guide helps you understand, review, and contribute to the Task Extractor tool.

## Table of Contents

- [Overview](#overview)
- [For Reviewers](#for-reviewers)
- [For Contributors](#for-contributors)
- [Architecture](#architecture)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Submitting Changes](#submitting-changes)

## Overview

The Task Extractor is a **V2 later-release tool** designed as a self-contained, isolated workspace. It extracts action items from email messages using rule-based pattern matching.

### Key Characteristics

- **No UI**: Pure backend/service layer
- **Isolated**: No dependencies on main app, routing, or database
- **Deterministic**: Same input always produces same output
- **Pure functions**: No side effects, no mutations, no network calls
- **Fully typed**: TypeScript with strict type checking
- **Well-tested**: Comprehensive vitest test suite

### Boundaries

All work must stay inside:

```
tools/v2/individual/task-extractor/
```

**Do NOT modify**:

- Main application shell
- Navigation or routing
- Database schema
- Authentication system
- Wallet core
- Stellar integration
- Design system
- Other tools or modules

## For Reviewers

### Quick Review Checklist

Use this checklist to validate a contribution:

#### 1. Boundary Compliance

- [ ] All changes are inside `tools/v2/individual/task-extractor/`
- [ ] No imports from outside the tool folder (except vitest, type utilities)
- [ ] No modifications to main app, routing, DB, or auth
- [ ] No UI components added

#### 2. Testing

- [ ] All existing tests pass: `npx vitest run --config tools/v2/individual/task-extractor/vitest.config.ts`
- [ ] New features have corresponding tests
- [ ] Tests are deterministic (no random values, no clock reads)
- [ ] Fixtures are updated if contract changes

#### 3. Type Safety

- [ ] No `any` types (except in tests for invalid input)
- [ ] All exports have explicit types
- [ ] No implicit `any` from compiler

#### 4. Documentation

- [ ] README.md updated if public API changes
- [ ] contract.md updated if types or behavior changes
- [ ] USAGE.md has examples for new features
- [ ] Inline comments explain non-obvious logic

#### 5. Code Quality

- [ ] Linter passes: `npm run lint`
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] Functions are pure (no side effects)
- [ ] No mutations of input objects
- [ ] Consistent naming and formatting

### Testing the PR

Clone the PR branch and run:

```sh
# Install dependencies (if not already done)
npm install

# Run tests
npx vitest run --config tools/v2/individual/task-extractor/vitest.config.ts

# Run linter
npm run lint

# Type check
npx tsc --noEmit

# Optional: Build to ensure no build errors
npm run build
```

### Manual Testing

Try the tool with sample input:

```typescript
// Create a test file: test-extractor.ts
import { safeExtractTasks } from "./tools/v2/individual/task-extractor";

const outcome = safeExtractTasks({
  messageId: "test-001",
  subject: "Test subject",
  body: `
    Please review the document by tomorrow.
    - [ ] Book the conference room
    - Send the meeting notes
  `,
  receivedAt: "2026-07-10T10:00:00.000Z",
});

console.log(JSON.stringify(outcome, null, 2));
```

Run it:

```sh
npx tsx test-extractor.ts
```

Expected output: An `ok` outcome with 3 tasks extracted.

### Common Issues to Watch For

1. **Mutations**: Ensure input objects aren't modified
2. **Side effects**: No network calls, file writes, or global state changes
3. **Non-determinism**: No `Math.random()`, `Date.now()`, or clock reads
4. **Boundary violations**: No imports from outside the tool folder
5. **Missing tests**: Every new feature needs tests
6. **Incorrect types**: No loose `any` types

## For Contributors

### Getting Started

1. **Fork and clone** the repository
2. **Create a feature branch** from `main`:
   ```sh
   git checkout -b feature/task-extractor-your-feature
   ```
3. **Install dependencies**:
   ```sh
   npm install
   ```
4. **Run tests** to ensure starting state is clean:
   ```sh
   npx vitest run --config tools/v2/individual/task-extractor/vitest.config.ts
   ```

### Making Changes

1. **Read existing code** to understand patterns
2. **Follow the architecture** (see below)
3. **Write tests first** (TDD approach recommended)
4. **Implement the feature**
5. **Update documentation**
6. **Run all checks** before committing

### Example: Adding a New Extraction Rule

Let's say you want to extract tasks from lines like `TODO: <task>`.

#### Step 1: Add Test

```typescript
// In tests/taskExtractor.test.ts
it("extracts TODO-prefixed tasks", () => {
  const result = extractTasks(makeInput({ body: "TODO: Update the wiki\nSome other text" }));
  expect(result.tasks).toHaveLength(1);
  expect(result.tasks[0].text).toBe("Update the wiki");
  expect(result.tasks[0].trigger).toBe("todo-prefix");
  expect(result.tasks[0].confidence).toBe("high");
});
```

#### Step 2: Update Types

```typescript
// In types/taskExtractor.ts
export type TaskTrigger =
  | "checkbox"
  | "request-phrase"
  | "bullet-action"
  | "imperative-line"
  | "todo-prefix"; // Add new trigger
```

#### Step 3: Implement Logic

```typescript
// In services/taskExtractor.ts

const TODO_PATTERN = /^TODO:\s*(.+)$/i;

function matchLine(line: string, source: TaskSource): Candidate | undefined {
  // ... existing patterns

  const todo = TODO_PATTERN.exec(line);
  if (todo) {
    return {
      text: todo[1],
      source,
      trigger: "todo-prefix",
      confidence: "high",
      contextLine: line,
    };
  }

  // ... rest of function
}
```

#### Step 4: Update Documentation

```typescript
// In docs/contract.md, update the extraction rules table:
| Trigger       | Matches           | Confidence |
| ------------- | ----------------- | ---------- |
| ...           | ...               | ...        |
| `todo-prefix` | `TODO: <task>`    | high       |
```

#### Step 5: Run Tests

```sh
npx vitest run --config tools/v2/individual/task-extractor/vitest.config.ts
```

#### Step 6: Add Fixture

```typescript
// In services/fixtures.ts
export const successFixtures: SuccessFixture[] = [
  // ... existing
  {
    name: "todo-prefix",
    input: {
      messageId: "msg-todo-001",
      subject: "",
      body: "TODO: Update the wiki\nTODO: Review PRs",
    },
    expectedTaskTexts: ["Update the wiki", "Review PRs"],
  },
];
```

## Architecture

### File Structure

```
tools/v2/individual/task-extractor/
├── index.ts                 # Public exports (barrel file)
├── README.md                # Overview and quick start
├── specs.md                 # Contributor boundaries
├── vitest.config.ts         # Test configuration
├── types/
│   └── taskExtractor.ts     # TypeScript types and interfaces
├── services/
│   ├── taskExtractor.ts     # Core extraction engine
│   ├── guards.ts            # Validation and sanitization
│   └── fixtures.ts          # Test fixtures
├── tests/
│   ├── taskExtractor.test.ts  # Core engine tests
│   ├── guards.test.ts         # Validation tests
│   ├── fixtures.test.ts       # Fixture validation
│   └── edge-cases.test.ts     # Edge case coverage
└── docs/
    ├── contract.md            # API contract documentation
    ├── TESTING.md             # Testing guide
    ├── USAGE.md               # Usage examples
    └── CONTRIBUTING.md        # This file
```

### Layers

1. **Types Layer** (`types/`)
   - TypeScript interfaces and type definitions
   - No implementation logic
   - Single source of truth for the contract

2. **Services Layer** (`services/`)
   - **taskExtractor.ts**: Pure extraction engine
   - **guards.ts**: Validation, sanitization, error handling
   - **fixtures.ts**: Sample inputs and expected outputs

3. **Public API** (`index.ts`)
   - Re-exports types and functions
   - No logic in barrel file

4. **Tests** (`tests/`)
   - Unit tests for all public functions
   - Edge case coverage
   - Fixture validation

5. **Documentation** (`docs/`)
   - Contract specification
   - Usage examples
   - Testing guide
   - Contributor guide (this file)

### Data Flow

```
User Input
    ↓
safeExtractTasks (guards.ts)
    ↓
validateInput → sanitizeInput → checkInputLimits
    ↓
extractTasks (taskExtractor.ts)
    ↓
matchLine (for each line) → detectPriority → detectDueHints
    ↓
Deduplication & Truncation
    ↓
TaskExtractionResult
    ↓
SafeTaskExtractionResult (ok | error)
```

### Key Design Principles

1. **Purity**: Functions don't mutate input or have side effects
2. **Determinism**: Same input always produces same output
3. **Isolation**: No external dependencies beyond TypeScript/Node types
4. **Type Safety**: Strict TypeScript with no implicit `any`
5. **Testability**: Every function can be tested in isolation
6. **Documentation**: Code is self-documenting with clear names and comments

## Development Workflow

### Daily Workflow

```sh
# Start watch mode for TDD
npx vitest watch --config tools/v2/individual/task-extractor/vitest.config.ts

# Make changes, watch tests re-run automatically

# Before committing, run full suite
npx vitest run --config tools/v2/individual/task-extractor/vitest.config.ts
npm run lint
npx tsc --noEmit
```

### Pre-Commit Checklist

- [ ] All tests pass
- [ ] Linter passes (no warnings)
- [ ] TypeScript compiles (no errors)
- [ ] Documentation updated
- [ ] No `console.log` statements left in code
- [ ] Commit message is clear and descriptive

### Commit Message Format

Use conventional commit format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

Examples:

```
feat(task-extractor): add TODO prefix extraction

Adds support for extracting tasks from lines like "TODO: task text".
New trigger type: todo-prefix with high confidence.

Closes #123
```

```
fix(task-extractor): handle leap year dates correctly

Previously rejected Feb 29 in leap years. Now validates calendar dates
properly using Date object.

Fixes #124
```

```
docs(task-extractor): add CONTRIBUTING.md

Comprehensive guide for reviewers and contributors including
architecture overview, development workflow, and code standards.
```

Types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `test`: Adding or updating tests
- `refactor`: Code refactoring (no behavior change)
- `perf`: Performance improvement
- `chore`: Maintenance tasks

## Code Standards

### TypeScript

- Use strict mode (enabled in tsconfig)
- No `any` types (except in test fixtures for invalid input)
- Prefer `interface` for objects, `type` for unions
- Export types alongside functions
- Use `readonly` for arrays/objects that shouldn't be mutated

### Naming Conventions

- **Functions**: camelCase, verb-noun (e.g., `extractTasks`, `validateInput`)
- **Types**: PascalCase (e.g., `TaskExtractionInput`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_TASKS_LIMIT`)
- **Variables**: camelCase, descriptive (e.g., `candidateCount`)

### Code Style

- **Indentation**: 2 spaces
- **Line length**: Aim for ≤100 characters
- **Semicolons**: Required
- **Quotes**: Double quotes for strings
- **Trailing commas**: Yes
- **Comments**: Use `//` for inline, `/** */` for JSDoc

### Function Guidelines

- Keep functions small (≤50 lines ideally)
- One responsibility per function
- Pure functions: no side effects
- No mutation of parameters
- Return early for error cases
- Avoid deep nesting (max 3 levels)

### Testing Guidelines

- One assertion per test when possible
- Descriptive test names (read like sentences)
- Use `describe` blocks to group related tests
- Test happy path, edge cases, and error cases
- No test interdependencies
- No shared mutable state between tests

## Submitting Changes

### Pull Request Process

1. **Ensure all tests pass**:

   ```sh
   npx vitest run --config tools/v2/individual/task-extractor/vitest.config.ts
   npm run lint
   npx tsc --noEmit
   ```

2. **Update documentation**:
   - README.md if API changes
   - contract.md if types change
   - USAGE.md for new features
   - Add inline comments for complex logic

3. **Create pull request** with:
   - Clear title describing the change
   - Description of what changed and why
   - Link to related issues
   - Screenshots/examples if applicable

4. **PR Template** (use this):

```markdown
## Description

Brief description of the change

## Type of Change

- [ ] New feature
- [ ] Bug fix
- [ ] Documentation update
- [ ] Refactoring
- [ ] Performance improvement

## Checklist

- [ ] All tests pass
- [ ] Linter passes
- [ ] TypeScript compiles with no errors
- [ ] Documentation updated
- [ ] No boundary violations (all changes in tool folder)
- [ ] Functions are pure (no side effects)
- [ ] No mutations of input objects
- [ ] Added tests for new behavior

## Testing

Describe how to test the changes

## Related Issues

Closes #XXX
```

5. **Address review feedback**:
   - Be responsive to reviewer comments
   - Make requested changes promptly
   - Ask questions if feedback is unclear

6. **Squash commits** (if requested by maintainers)

### Review Process

1. Automated checks run (CI)
2. Maintainer reviews code
3. Feedback provided (if needed)
4. Contributor addresses feedback
5. Approval and merge

## Questions?

- **File an issue** for bugs or feature requests
- **Start a discussion** for questions or ideas
- **Check existing issues** before opening new ones

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.

---

Thank you for contributing to the Task Extractor! 🎉
