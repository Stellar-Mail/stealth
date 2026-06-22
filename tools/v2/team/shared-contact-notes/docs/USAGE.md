# Shared Contact Notes Usage

This document gives maintainers and OSS contributors a folder-local way to
review Shared Contact Notes without connecting it to the main mail app.

## Setup

Run commands from the repository root so Vitest can resolve the shared TypeScript
and Vite configuration:

```bash
npm ci
npx vitest run tools/v2/team/shared-contact-notes/tests/service.test.ts
npx vitest run tools/v2/team/shared-contact-notes/tests/components.test.tsx
```

The tool is intentionally isolated. A review should not require changes to app
routing, dashboard navigation, auth, wallet logic, Stellar integration, database
schema, or the shared design system.

## Service Usage

Use `NoteService` when testing the core note workflow in isolation:

```ts
import { seedNotes } from "../fixtures/notes";
import { NoteService } from "../service";

const service = new NoteService(seedNotes);

const created = await service.create({
  contactId: "contact-alice",
  content: "Follow up after renewal review.",
  authorId: "user-manager",
});

const notesForAlice = await service.getByContact(created.contactId);
```

The service returns defensive copies so callers cannot mutate the internal
in-memory store by editing returned objects.

## Fixture Notes

`fixtures/notes.ts` provides deterministic review data:

| Fixture | Contact | Purpose |
| --- | --- | --- |
| `note-alice-1` | `contact-alice` | Active note for multi-note contact coverage |
| `note-alice-2` | `contact-alice` | Second active note for ordering and count checks |
| `note-bob-1` | `contact-bob` | Archived note coverage |
| `note-carol-1` | `contact-carol` | Single-note contact coverage |
| `note-dave-1` | `contact-dave` | Additional independent contact coverage |

Use these fixtures for local tests and manual review notes instead of connecting
to production contacts or main app state.

## Review Checklist

- Confirm all changed files stay under `tools/v2/team/shared-contact-notes/`.
- Run the folder-local service and component tests listed above.
- Read `tests/test-plan.md` to compare executable coverage with the intended
  scenarios.
- Confirm the tool remains disconnected from main app navigation and routing.
- Confirm future app integration needs are recorded as follow-up work, not added
  to this isolated review.

## Known Limitations

- Notes are stored in memory only; there is no persistence layer.
- There is no authentication, authorization, or role-based permission model.
- The tool does not consume the main app's contact, mailbox, or organization
  models yet.
- There is no real-time collaboration or multi-user conflict handling.
- The component layer is reviewed as an isolated surface and is not mounted in
  the production app shell.

## Follow-Up Boundaries

Future integration work can decide how notes map to real contacts, which roles
can create or archive notes, and where the UI appears in the mail workflow. Those
decisions should remain outside this issue so the current contribution stays
self-contained and reviewable.
