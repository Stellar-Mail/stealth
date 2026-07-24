# Calendar Event Extractor Review Notes

## Scope

This documentation pass is limited to:

```text
tools/v1/individual/calendar-event-extractor/
```

It does not wire the tool into the main app, inbox architecture, Gmail, routing,
database schema, wallet services, calendar integrations, or shared design
system.

## What Changed

- Replaced generated placeholder README content with V1 individual ownership,
  intended usage, event draft states, and testing focus.
- Replaced generated placeholder specs with a reviewable event extraction
  contract.
- Added `docs/test-plan.md` with automated, manual, and regression coverage.
- Added `docs/fixtures.md` with synthetic absolute-date, relative-date, missing
  end time, conflict, duplicate, newsletter false-positive, and empty cases.

## Acceptance Coverage

- Architecture: folder boundary and non-integration constraints are explicit.
- Feature: draft/ready/ambiguous/dismissed states, title, start/end time,
  location, attendees, duplicate prevention, warnings, and confidence are
  defined.
- UI and accessibility: text-visible state, editable fields, keyboard controls,
  ambiguity warnings, and long text handling are documented.
- Security and performance: no mailbox mutation, no external calendar events,
  no invites/RSVPs, no external transmission, and bounded parsing are
  documented.
- Testing and documentation: test plan and fixture catalog are included.

## Known Limitations

- Baseline extraction is local and advisory until a future integration issue
  defines persistence.
- Natural-language date support is intentionally scoped to testable examples.
- Future calendar integration must preserve explicit user action before
  external side effects.
