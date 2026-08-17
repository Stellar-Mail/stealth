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
- `tests/service.test.ts` contains executable Vitest unit tests (service layer).
- `tests/components.test.tsx` contains Vitest component tests (UI layer).
- `tests/test-plan.md` documents all test scenarios.
- `hooks/useContactNotes.ts` provides React hook wrapping NoteService with `useReducer`.
- `components/` contains all React UI components with empty, loading, error, and success states.
- `docs/ACCESSIBILITY.md` documents WCAG 2.1 AA compliance measures.
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
- The UI layer is self-contained and not wired into the main app shell or routing.
- No real-time or multi-user collaboration support.

## Non-UI execution contract

The note engine also exposes a presentation-free execution contract so it can
run as a backend service, independent of any UI.

- `contract.ts` — the typed `NotesOperation` / `NotesContractOutput`, the
  `NotesResult<T>` discriminated union, explicit `NoteErrorCode` values, and the
  `createNotesContract(service)` factory. The contract adapts the existing
  `NoteService` (which throws `ValidationError` / `NoteNotFoundError`) into typed
  results, so callers never catch exceptions.
- `contract.fixtures.ts` — representative create inputs (valid, empty content).
- `tests/contract.test.ts` — vitest coverage of the full lifecycle plus the
  validation / not-found error paths.

Usage:

```ts
import { NoteService, createNotesContract } from ".";

const service = new NoteService([], { delayMs: 0 });
const contract = createNotesContract(service);
const res = await contract.execute({
  operation: "create",
  input: { contactId: "contact-acme", content: "Prefers async updates.", authorId: "user-ada" },
});
if (res.ok && res.value.operation === "create") {
  // res.value.note has the persisted note
} else {
  // res.error is a NoteErrorCode
}
```
