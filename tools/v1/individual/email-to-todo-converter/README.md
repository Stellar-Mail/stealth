# Email-to-Todo Converter

This folder is the isolated workspace for the Email-to-Todo Converter tool.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v1/individual/email-to-todo-converter/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

## Contributor Setup

This tool does not ship executable code yet. Until a feature issue adds the
implementation, contributors should use the local documentation in this folder
as the launch contract:

- `specs.md` defines the behavior and folder ownership boundary.
- `docs/test-plan.md` lists the acceptance scenarios that future tests should
  cover.
- `docs/fixtures.md` describes the fixture emails and expected task outputs.
- `REVIEW_NOTES.md` gives reviewers a quick checklist for this isolated work.

## Intended Usage

The tool converts an email into one or more actionable tasks. A future feature
implementation should accept a normalized email object, extract the task title,
due date, priority, source metadata, and completion state, then return a
reviewable task draft without mutating the mailbox or main application state.

## Known Limitations

- No production code is present in this folder yet.
- The documented tests are a plan, not an executable suite.
- Main app routing, inbox integration, and persistence are intentionally out of
  scope until a future integration issue allows them.
