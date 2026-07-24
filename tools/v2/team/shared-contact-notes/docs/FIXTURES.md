# Shared Contact Notes — Test Fixtures

This document explains how to use, extend, and create test fixtures for the Shared Contact Notes tool.

## Overview

Test fixtures provide deterministic seed data for tests. The tool includes a complete set of seed notes covering common scenarios:

- Multiple notes per contact
- Archived and active notes
- Different authors
- Various note content

## Default Fixture Set

The `fixtures/notes.ts` file exports `seedNotes` — a 5-note fixture covering 4 contacts:

```typescript
import { seedNotes } from "../fixtures/notes";
```

### Fixture Details

| ID           | Contact       | Content                                    | Author         | Status   |
| ------------ | ------------- | ------------------------------------------ | -------------- | -------- |
| note-alice-1 | contact-alice | "Alice prefers email communication..."     | user-current   | Active   |
| note-alice-2 | contact-alice | "Follow up on Q2 proposal..."              | user-colleague | Active   |
| note-bob-1   | contact-bob   | "Bob is the technical contact..."          | user-current   | Archived |
| note-carol-1 | contact-carol | "Carol shared her public key..."           | user-current   | Active   |
| note-dave-1  | contact-dave  | "Dave requested pricing for enterprise..." | user-sales     | Active   |

### Fixture Characteristics

- **Deterministic timestamps**: All dates are fixed (June 2026) for reproducibility
- **Data isolation**: No dependencies between notes
- **Coverage**: Exercises both happy paths and edge cases (archived notes, multiple notes)
- **Realistic content**: Notes represent actual use cases (communication preferences, project details)

## Using Fixtures in Tests

### Service Tests

```typescript
import { NoteService } from "../service";
import { seedNotes } from "../fixtures/notes";

describe("getByContact", () => {
  it("should return all notes for a contact", async () => {
    // Initialize service with fixture data
    const service = new NoteService(seedNotes, { delayMs: 0 });

    // Query notes for Alice (who has 2 notes)
    const notes = await service.getByContact("contact-alice");

    expect(notes).toHaveLength(2);
    expect(notes.map((n) => n.id).sort()).toEqual(["note-alice-1", "note-alice-2"]);
  });

  it("should return empty array for unknown contact", async () => {
    const service = new NoteService(seedNotes, { delayMs: 0 });
    const notes = await service.getByContact("contact-unknown");

    expect(notes).toEqual([]);
  });

  it("should include archived notes", async () => {
    const service = new NoteService(seedNotes, { delayMs: 0 });
    const notes = await service.getByContact("contact-bob");

    // Bob has 1 archived note
    expect(notes).toHaveLength(1);
    expect(notes[0].archivedAt).not.toBeNull();
  });
});
```

### Component Tests

```typescript
import { render, screen } from "@testing-library/react";
import { SharedContactNotes } from "../components/SharedContactNotes";
import { NoteService } from "../service";
import { seedNotes } from "../fixtures/notes";

describe("SharedContactNotes", () => {
  it("displays notes for a contact", async () => {
    const service = new NoteService(seedNotes, { delayMs: 0 });
    render(<SharedContactNotes contactId="contact-alice" service={service} />);

    // Alice's notes appear in the UI
    expect(screen.getByText(/Alice prefers email/)).toBeDefined();
    expect(screen.getByText(/Follow up on Q2/)).toBeDefined();
  });
});
```

## Creating Custom Fixtures

For specific test scenarios, create custom fixture arrays:

### Example 1: Contact with Single Note

```typescript
const singleNoteFixture: Note[] = [
  {
    id: "note-single",
    contactId: "contact-minimal",
    content: "Single note for testing",
    authorId: "user-test",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    archivedAt: null,
  },
];

const service = new NoteService(singleNoteFixture, { delayMs: 0 });
```

### Example 2: All Archived Notes

```typescript
const archivedFixture: Note[] = [
  {
    id: "note-archived-1",
    contactId: "contact-archive-test",
    content: "Old note 1",
    authorId: "user-old",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    archivedAt: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "note-archived-2",
    contactId: "contact-archive-test",
    content: "Old note 2",
    authorId: "user-old",
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    archivedAt: "2026-06-02T00:00:00.000Z",
  },
];

const service = new NoteService(archivedFixture, { delayMs: 0 });
```

### Example 3: Large Dataset

```typescript
function generateLargeFixture(count: number): Note[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `note-${i}`,
    contactId: `contact-${i % 5}`, // Distribute across 5 contacts
    content: `Test note ${i}`,
    authorId: `user-${i % 3}`, // Distribute across 3 authors
    createdAt: new Date(2026, 5, 1 + (i % 30)).toISOString(),
    updatedAt: new Date(2026, 5, 1 + (i % 30)).toISOString(),
    archivedAt: i % 10 === 0 ? new Date(2026, 6, 1).toISOString() : null,
  }));
}

const service = new NoteService(generateLargeFixture(100), { delayMs: 0 });
```

## Fixture Factory Helper

Create a helper for building fixtures programmatically:

```typescript
import type { Note } from "../types";

interface FixtureBuilder {
  withContact(contactId: string): FixtureBuilder;
  withAuthor(authorId: string): FixtureBuilder;
  archived(): FixtureBuilder;
  build(): Note[];
}

function createFixture(): FixtureBuilder {
  let contactId = "contact-default";
  let authorId = "user-default";
  let isArchived = false;
  const notes: Note[] = [];

  return {
    withContact(cid: string) {
      contactId = cid;
      return this;
    },
    withAuthor(aid: string) {
      authorId = aid;
      return this;
    },
    archived() {
      isArchived = true;
      return this;
    },
    build() {
      const now = new Date().toISOString();
      const note: Note = {
        id: crypto.randomUUID(),
        contactId,
        content: `Note for ${contactId}`,
        authorId,
        createdAt: now,
        updatedAt: now,
        archivedAt: isArchived ? now : null,
      };
      return [note];
    },
  };
}

// Usage:
const customNote = createFixture().withContact("contact-special").withAuthor("user-vip").build();
```

## Fixture Naming Conventions

Follow consistent naming for easy identification:

- **Contact IDs**: `contact-<role>` e.g., `contact-alice`, `contact-prospect`
- **User IDs**: `user-<role>` e.g., `user-current`, `user-sales`, `user-colleague`
- **Note IDs**: `note-<sequence>` or `note-<contact>-<num>` e.g., `note-1`, `note-alice-1`

Example:

```typescript
const fixture: Note[] = [
  {
    id: "note-prospect-sales-1",
    contactId: "contact-prospect-acme",
    authorId: "user-sales-team",
    content: "Initial outreach for Q3 contract",
    createdAt: "2026-06-01T10:00:00.000Z",
    updatedAt: "2026-06-01T10:00:00.000Z",
    archivedAt: null,
  },
];
```

## Fixture Isolation

Each test should create its own service instance:

```typescript
it("test 1", async () => {
  const service = new NoteService(seedNotes, { delayMs: 0 });
  const note = await service.create({ ... });
  // Modifications to 'service' don't affect other tests
});

it("test 2", async () => {
  const service = new NoteService(seedNotes, { delayMs: 0 });
  // Fresh copy of seedNotes, unaffected by test 1
  const notes = await service.getByContact("contact-alice");
});
```

## Fixture Best Practices

1. **Use default fixtures first**: Start with `seedNotes` for common scenarios
2. **Minimal custom fixtures**: Create only when testing specific scenarios
3. **Deterministic data**: Use fixed dates, not `new Date()`
4. **Descriptive names**: Include test scenario in fixture name
5. **Document intent**: Add comments explaining why specific fixture is needed

Example:

```typescript
// Fixture for testing archive behavior: one active, one archived
const archiveTestFixture: Note[] = [
  {
    id: "note-active-archive-test",
    contactId: "contact-archive-demo",
    content: "Active note",
    authorId: "user-test",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    archivedAt: null, // Active
  },
  {
    id: "note-archived-archive-test",
    contactId: "contact-archive-demo",
    content: "Previously archived note",
    authorId: "user-test",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    archivedAt: "2026-06-01T12:00:00.000Z", // Archived
  },
];

it("should not change archivedAt when archiving already archived note", async () => {
  const service = new NoteService(archiveTestFixture, { delayMs: 0 });
  const original = await service.getById("note-archived-archive-test");
  const result = await service.archive("note-archived-archive-test");

  expect(result.archivedAt).toBe(original.archivedAt);
});
```

## Deep Copying Fixtures

When modifying fixtures, ensure you deep copy to avoid mutation:

```typescript
// Good: Creates a new array with copied note objects
const customFixture = seedNotes.map((note) => ({ ...note }));

// Avoid: Shares references with original
const badCopy = seedNotes;
```

## See Also

- [test-plan.md](../tests/test-plan.md) — Complete test scenario coverage
- [SETUP.md](./SETUP.md) — Running tests
- [review-notes.md](./review-notes.md) — Reviewer checklist
