# Shared Contact Notes — Test Plan

Executable tests are in `tests/service.test.ts`. This document describes the coverage.

## Fixture Setup

Use `fixtures/notes.ts` — contains 5 seed notes across 4 contacts:

| Note ID        | Contact       | Archived |
| -------------- | ------------- | -------- |
| `note-alice-1` | contact-alice | No       |
| `note-alice-2` | contact-alice | No       |
| `note-bob-1`   | contact-bob   | Yes      |
| `note-carol-1` | contact-carol | No       |
| `note-dave-1`  | contact-dave  | No       |

## Scenarios

| Scenario                         | Test                                | Expected Result                                               |
| -------------------------------- | ----------------------------------- | ------------------------------------------------------------- |
| Create valid note                | `create` > valid input              | Returns `Note` with generated id, timestamps, null archivedAt |
| Create trims whitespace          | `create` > whitespace               | Fields are trimmed before storage                             |
| Create empty content             | `create` > empty content            | Throws `ValidationError`                                      |
| Create missing contactId         | `create` > missing contactId        | Throws `ValidationError`                                      |
| Create missing authorId          | `create` > missing authorId         | Throws `ValidationError`                                      |
| Create — all fields invalid      | `create` > multiple errors          | Throws `ValidationError` with 3 field errors                  |
| GetByContact — multiple results  | `getByContact` > contact-alice      | Returns 2 notes                                               |
| GetByContact — no results        | `getByContact` > unknown contact    | Returns empty array                                           |
| GetByContact — includes archived | `getByContact` > contact-bob        | Returns note with non-null archivedAt                         |
| GetByContact — returns copies    | `getByContact` > mutation isolation | Mutating result does not affect store                         |
| GetByContact — empty contactId   | `getByContact` > empty              | Throws `ValidationError`                                      |
| GetById — exists                 | `getById` > existing                | Returns note                                                  |
| GetById — missing                | `getById` > non-existent            | Throws `NoteNotFoundError`                                    |
| GetById — error has id           | `getById` > missing                 | Error.noteId matches requested id                             |
| GetById — returns copy           | `getById` > mutation isolation      | Mutating result does not affect store                         |
| Update content                   | `update` > valid                    | Returns note with updated content and updatedAt               |
| Update preserves fields          | `update` > partial                  | Only specified fields change                                  |
| Update trim content              | `update` > whitespace               | Content is trimmed                                            |
| Update empty content             | `update` > empty                    | Throws `ValidationError`                                      |
| Update missing note              | `update` > non-existent             | Throws `NoteNotFoundError`                                    |
| Update empty id                  | `update` > empty                    | Throws `ValidationError`                                      |
| Delete existing                  | `delete` > existing                 | Note removed from store                                       |
| Delete missing                   | `delete` > non-existent             | Throws `NoteNotFoundError`                                    |
| Delete empty id                  | `delete` > empty                    | Throws `ValidationError`                                      |
| Delete reduces count             | `delete` > count                    | Batch notes reduced by 1                                      |
| Archive unarchived               | `archive` > active note             | Sets archivedAt timestamp                                     |
| Archive returns note             | `archive` > active note             | Returns full Note object                                      |
| Archive already archived         | `archive` > archived note           | preservedAt unchanged                                         |
| Archive missing                  | `archive` > non-existent            | Throws `NoteNotFoundError`                                    |
| Archive empty id                 | `archive` > empty                   | Throws `ValidationError`                                      |

## Negative Checks

- Empty service initializes with zero notes.
- All operations return Promises (async).
- Validation errors are deterministic for the same input.
- Not-found errors are deterministic for the same missing id.
- Seeded services with same data produce identical results.
- All mutations return copies, not internal references.

## Running

```bash
npx vitest run tools/v2/team/shared-contact-notes/tests/service.test.ts
```
