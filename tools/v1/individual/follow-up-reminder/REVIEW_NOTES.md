# Follow-up Reminder Review Notes

## Scope

This documentation pass is limited to:

```text
tools/v1/individual/follow-up-reminder/
```

It does not wire the tool into the main app, inbox architecture, Gmail, routing,
database schema, wallet services, calendar integrations, or shared design
system.

## What Changed

- Replaced generated placeholder README content with V1 individual ownership,
  intended usage, reminder states, and testing focus.
- Replaced generated placeholder specs with a reviewable reminder contract.
- Added `docs/test-plan.md` with automated, manual, and regression coverage.
- Added `docs/fixtures.md` with synthetic explicit, relative-date, ambiguous,
  duplicate, FYI false-positive, and empty-content cases.

## Acceptance Coverage

- Architecture: folder boundary and non-integration constraints are explicit.
- Feature: draft/scheduled/snoozed/completed/dismissed states, due time,
  source message, duplicate prevention, warnings, and confidence are defined.
- UI and accessibility: text-visible state, editable due time, keyboard
  controls, and screen-reader-reachable warnings are documented.
- Security and performance: no mailbox mutation, no external calendar events,
  no automatic email sending, and bounded date parsing are documented.
- Testing and documentation: test plan and fixture catalog are included.

## Known Limitations

- Baseline reminder suggestions are local drafts until a future integration
  issue defines persistence.
- Natural-language date support is intentionally scoped to testable examples.
- Future inbox or calendar integration must preserve explicit user action
  before external side effects.
