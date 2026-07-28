# Email-to-Todo Converter

This folder is the isolated workspace for the Email-to-Todo Converter tool.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v1/individual/email-to-todo-converter/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

## Architecture

The tool follows a layered architecture:

- `services/emailToTodo.ts` -- core pure engine. Deterministic functions that convert a normalized email into a task draft (title, notes, due date, priority).
- `services/guards.ts` -- security and validation layer. Sanitizes input, enforces size limits, and provides a hardened `safeBuildTaskDraft` entry point.
- `services/fixtures.ts` -- deterministic synthetic fixtures for testing.
- `ui/` -- React component and view-model helpers that render the converter workflow on top of the services layer.

## Intended Use

- Convert a normalized email into a reviewable task draft.
- Detect priority from keyword heuristics in subject/body.
- Suggest a due date based on priority level.
- Preserve user review before any task is saved or synced.

## Testing

Run tests from the tool folder:

```bash
npx vitest run
```

Test files live in `tests/` and cover the core engine, guard layer, fixtures, and view-model helpers.

## Known Limitations

- Main app routing, inbox integration, and persistence are intentionally out of scope until a future integration issue allows them.
- Priority detection is keyword-based only; no ML or NLP.
- Due date suggestion is a simple offset, not calendar-aware.
