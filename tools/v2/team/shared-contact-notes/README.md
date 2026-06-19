# Shared Contact Notes

Shared Contact Notes is an isolated V2 team tool engine for creating, reading,
updating, and archiving notes about shared contacts. It is not wired into the
main mail app yet; this folder captures the complete core engine until a future
integration issue connects it.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v2/team/shared-contact-notes/
```

Do not modify the main application shell, dashboard layout, routing, inbox
architecture, wallet core, Stellar integration, database schema, or shared
design system from this issue.

## Review Map

- `types.ts` defines all data types and input contracts.
- `errors.ts` defines deterministic error types (`ValidationError`, `NoteNotFoundError`).
- `validation.ts` provides pure validation functions.
- `service.ts` implements the `NoteService` class with in-memory CRUD.
- `index.ts` is the public barrel export.
- `fixtures/notes.ts` provides deterministic seed data for tests.
- `tests/service.test.ts` contains executable Vitest unit tests.
- `tests/test-plan.md` documents all test scenarios.
- `docs/review-notes.md` gives maintainers a review checklist.

## Intended Behavior

The engine provides note management for shared contacts:

- **Create** a note for a contact with content and author attribution.
- **Read** all notes for a specific contact, or a single note by id.
- **Update** note content (partial updates supported).
- **Delete** a note permanently.
- **Archive** a note (idempotent — archiving an archived note is a no-op).

All operations are async with a configurable delay for deterministic loading
state simulation. With `delayMs: 0` (the default), operations resolve
immediately but still return Promises, allowing UI layers to always await.

## Known Limitations

- No persistence — the store is an in-memory `Map`.
- No authentication or authorization — any caller can perform any operation.
- No integration with the main application's contact models.
- No React components, hooks, or UI.
- No real-time or multi-user collaboration support.
