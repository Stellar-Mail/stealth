# Shared Contact Notes — Setup & Development

This document covers setup, running tests, using fixtures, and understanding the test environment for the Shared Contact Notes tool.

## Quick Start

### Prerequisites

- Node.js 18+ (with Bun or npm/yarn)
- The project uses Vitest for unit and component tests

### Installation

From the workspace root:

```bash
bun install
# or
npm install
```

### Running Tests

From the workspace root:

```bash
# Run all tests for this tool
bun test tools/v2/team/shared-contact-notes/tests

# Or run a specific test suite
bun test tools/v2/team/shared-contact-notes/tests/service.test.ts
bun test tools/v2/team/shared-contact-notes/tests/contract.test.ts
bun test tools/v2/team/shared-contact-notes/tests/components.test.tsx

# Watch mode for development
bun run test:watch tools/v2/team/shared-contact-notes/tests
```

## Test Structure

### 1. Service Tests (`tests/service.test.ts`)

Tests the core `NoteService` class with all CRUD operations:

- **Create**: Valid input, whitespace handling, validation errors
- **Read by Contact**: Multiple results, empty results, archived notes, data isolation
- **Read by ID**: Existing notes, missing notes, data isolation
- **Update**: Content changes, field preservation, validation, not-found scenarios
- **Delete**: Removal, missing notes, count verification
- **Archive**: Archiving unarchived notes, idempotent archiving, missing notes

**Run:**

```bash
bun test tools/v2/team/shared-contact-notes/tests/service.test.ts
```

**Coverage:** 40+ test cases covering happy paths, edge cases, and error scenarios.

### 2. Contract Tests (`tests/contract.test.ts`)

Tests the non-UI execution contract — typed inputs/outputs, result unions, and error codes:

- **Result helpers**: `ok()` and `fail()` functions
- **Full lifecycle**: Create → Get → Update → Archive → Delete
- **Error handling**: Validation errors, not-found errors, determinism
- **Type safety**: Discriminated union types for results

**Run:**

```bash
bun test tools/v2/team/shared-contact-notes/tests/contract.test.ts
```

**Coverage:** 15+ test cases for contract layer and lifecycle operations.

### 3. Component Tests (`tests/components.test.tsx`)

Tests the React UI layer:

- **Rendering**: Component loads with proper heading
- **Loading state**: Initial loading indicator visible
- **Success state**: Notes display after loading
- **Empty state**: Proper message for no notes
- **User interactions**: Adding/editing/deleting notes (with mocked service)
- **Error handling**: Error state display

**Run:**

```bash
bun test tools/v2/team/shared-contact-notes/tests/components.test.tsx
```

**Coverage:** 15+ test cases for UI behavior and user interactions.

## Test Fixtures

### Seeded Data

The tool includes deterministic test fixtures in `fixtures/notes.ts`:

```typescript
import { seedNotes } from "../fixtures/notes";

const service = new NoteService(seedNotes, { delayMs: 0 });
const notes = await service.getByContact("contact-alice");
// Returns 2 notes for Alice
```

**Fixture Notes:**

| Contact       | Notes | Archived |
| ------------- | ----- | -------- |
| contact-alice | 2     | 0        |
| contact-bob   | 1     | 1        |
| contact-carol | 1     | 0        |
| contact-dave  | 1     | 0        |

### Creating Custom Fixtures

For custom test scenarios, create a `NoteService` with specific seed data:

```typescript
const customNotes: Note[] = [
  {
    id: "note-1",
    contactId: "contact-custom",
    content: "Custom note for testing",
    authorId: "user-test",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    archivedAt: null,
  },
];

const service = new NoteService(customNotes, { delayMs: 0 });
```

## Service Configuration

The `NoteService` accepts a `ServiceConfig` object:

```typescript
export interface ServiceConfig {
  delayMs?: number; // Simulated async delay (default: 0 for tests)
}
```

### Using `delayMs` for Development

By default, tests run with `delayMs: 0` for instant execution. For development/demo scenarios:

```typescript
const service = new NoteService(seedNotes, { delayMs: 500 });
// Operations will delay 500ms, simulating realistic async behavior
```

## Test Environment Details

### Vitest Setup

- **Framework**: Vitest
- **Environment**: Node.js for service/contract tests; jsdom for component tests
- **Libraries**: @testing-library/react for component testing
- **Mock data**: `fixtures/notes.ts` for deterministic seed data

### Determinism

All tests are deterministic:

- Same input always produces the same validation errors
- Seed data always produces the same query results
- No external API calls, network requests, or database queries
- No timers or clock-dependent behavior (when `delayMs: 0`)

## Running Full Test Suite

From the workspace root:

```bash
# Run all tests (including main app tests)
bun test

# Run only tool tests
bun test tools/v2/team/shared-contact-notes/tests

# Run with coverage report
bun test -- --coverage tools/v2/team/shared-contact-notes/tests
```

## Debugging Tests

### Watch Mode

```bash
bun run test:watch tools/v2/team/shared-contact-notes/tests
```

The watcher will re-run tests when source files change.

### Console Output

Add `console.log()` statements directly in tests; Vitest will display output when tests fail:

```typescript
it("should create a note", async () => {
  const service = createService();
  const note = await service.create(validInput);
  console.log("Created note:", note); // Visible in test output if assertion fails
  expect(note.id).toBeDefined();
});
```

### Single Test

Run a specific test with `.only`:

```typescript
it.only("should create a note", async () => {
  // Only this test runs
});
```

## Import Paths

All imports within the tool are relative:

```typescript
import { NoteService } from "../service";
import { ValidationError } from "../errors";
import { seedNotes } from "../fixtures/notes";
import type { Note, CreateNoteInput } from "../types";
```

## Type Checking

Run TypeScript type checking:

```bash
bun run tsc --noEmit tools/v2/team/shared-contact-notes
```

Or from the workspace root:

```bash
bun run tsc --noEmit
```

## Known Limitations

- In-memory storage only (no persistence)
- No authentication or authorization
- No integration with main app (yet)
- Component tests mock the service; no end-to-end UI tests against persistence layer

See [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md) for detailed information.

## Next Steps

- Review the [test plan](../tests/test-plan.md) for complete scenario documentation
- Check [ACCESSIBILITY.md](./ACCESSIBILITY.md) for UI accessibility details
- See [review-notes.md](./review-notes.md) for reviewer checklist
