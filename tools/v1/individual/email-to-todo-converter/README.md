# Email-to-Todo Converter

This folder is the isolated workspace for the Email-to-Todo Converter tool.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v1/individual/email-to-todo-converter/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

## Contributor Setup

This tool now ships a self-contained implementation plus tests and docs. Use the
local documentation in this folder as the launch contract:

- `specs.md` defines the behavior and folder ownership boundary.
- `docs/test-plan.md` lists the acceptance scenarios that future tests should
  cover.
- `docs/API.md` documents the local UI, helper, and data contracts.
- `docs/fixtures.md` describes the fixture emails and expected task outputs.
- `REVIEW_NOTES.md` gives reviewers a quick checklist for this isolated work.

## Intended Usage

The tool converts an email into one or more actionable tasks. It accepts a
normalized email object, extracts the task title, due date, priority, and
source metadata, then returns a reviewable task draft without mutating the
mailbox or main application state.

## Known Limitations

- The implementation remains isolated from the main app until a future
  integration issue allows wiring.
- The component is still review-first; saving to an external task system is not
  wired up.
- Main app routing, inbox integration, and persistence are intentionally out of
  scope until a future integration issue allows them.
