# Shared Contact Notes Specs

## Purpose

Provide a shared team workspace for attaching notes to contacts. Notes are
visible to all team members and support collaborative context about customers,
partners, and prospects.

## Input Contract

### CreateNoteInput

```ts
type CreateNoteInput = {
  contactId: string;
  content: string;
  authorId: string;
};
```

### UpdateNoteInput

```ts
type UpdateNoteInput = {
  content?: string;
};
```

## Output Contract

### Note

```ts
type Note = {
  id: string;
  contactId: string;
  content: string;
  authorId: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  archivedAt: string | null;
};
```

### Errors

| Error               | Condition              | Shape                              |
| ------------------- | ---------------------- | ---------------------------------- |
| `ValidationError`   | Input fails validation | `{ fields: [{ field, message }] }` |
| `NoteNotFoundError` | Note id does not exist | `{ noteId: string }`               |

## Service Operations

| Operation      | Input                           | Output   | Error                                  |
| -------------- | ------------------------------- | -------- | -------------------------------------- |
| `create`       | `CreateNoteInput`               | `Note`   | `ValidationError`                      |
| `getByContact` | `contactId: string`             | `Note[]` | `ValidationError`                      |
| `getById`      | `id: string`                    | `Note`   | `NoteNotFoundError`                    |
| `update`       | `id: string`, `UpdateNoteInput` | `Note`   | `ValidationError`, `NoteNotFoundError` |
| `delete`       | `id: string`                    | `void`   | `ValidationError`, `NoteNotFoundError` |
| `archive`      | `id: string`                    | `Note`   | `ValidationError`, `NoteNotFoundError` |

## Determinism Guarantees

- All operations are async with a configurable `delayMs` in `ServiceConfig`.
- With `delayMs: 0` (test default), all operations resolve on microtask tick.
- Validation errors are deterministic — same invalid input always produces the
  same field error list.
- Not-found errors are deterministic — same missing id always produces the same
  error message.
- Seeded services with identical seed data produce identical query results.

## Loading States

Loading states are represented by the async lifecycle of each method:

- **Idle**: No operation in flight.
- **Loading**: Operation has started but not resolved. UI can use the pending
  Promise or a wrapping state machine to show a loading indicator.
- **Success**: Operation resolved with data.
- **Error**: Operation rejected with a `ValidationError` or `NoteNotFoundError`.

Since `delayMs` is configurable, UI layers can simulate realistic loading
durations during development and testing by setting `delayMs > 0`.

## Error States

- **Validation errors** are deterministic and include the list of failing fields
  with human-readable messages.
- **Not-found errors** include the requested note id for error recovery.
- Errors are thrown (not returned in result unions) to align with standard
  async/await error handling patterns.

## Test Fixtures

Use `fixtures/notes.ts` as the baseline seed set for unit tests. It covers:

- Multiple notes for a single contact (contact-alice: 2 notes)
- Archived notes (contact-bob: 1 archived note)
- Single-note contacts (contact-carol, contact-dave)
- Contacts with no notes (derived — assert empty array)
- Various authors (user-current, user-colleague, user-sales)

## Review Expectations

Reviewers should verify:

1. All changes stay inside `tools/v2/team/shared-contact-notes/`.
2. No network calls, persistence, or production dependencies exist.
3. Every operation has test coverage for success, validation failure, and
   not-found error paths.
4. The async delay mechanism is configurable and defaults to `0`.
5. Seeded services produce deterministic results.
6. The public API surface is limited to what `index.ts` exports.
