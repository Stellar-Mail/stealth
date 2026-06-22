# Email-to-Todo Converter

This folder is the isolated workspace for the Email-to-Todo Converter tool.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v1/individual/email-to-todo-converter/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet
core, Stellar core, database schema, or existing design system unless a future
integration issue explicitly allows it.

## Contributor Setup

This tool ships folder-local code and documentation only. Contributors should
use the local files in this folder as the launch contract:

- `specs.md` defines the behavior and folder ownership boundary.
- `services/emailToTodoCore.ts` implements the deterministic core extraction
  service.
- `fixtures/emailToTodoFixtures.ts` provides local sample emails for tests and
  future UI work.
- `docs/core-engine.md` documents the service inputs, outputs, loading state,
  and error state.
- `docs/test-plan.md` lists the acceptance scenarios that future tests should
  cover.
- `docs/fixtures.md` describes the fixture emails and expected task outputs.
- `REVIEW_NOTES.md` gives reviewers a quick checklist for this isolated work.

## Intended Usage

The tool converts an email into one or more actionable tasks. The core service
accepts a normalized email object, extracts the task title, due date, priority,
source metadata, and completion state, then returns a reviewable task draft
without mutating the mailbox or main application state.

## Known Limitations

- Extraction is deterministic and pattern based; no LLM or external task
  provider is called.
- Persistence and saving remain out of scope.
- Main app routing, inbox integration, and persistence are intentionally out of
  scope until a future integration issue allows them.
