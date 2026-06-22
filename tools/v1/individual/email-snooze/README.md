# Email Snooze

This folder is the isolated workspace for the Email Snooze tool.

## Ownership Boundary

All work for this tool must stay inside:

`text
.\tools\v1\individual\email-snooze\
`

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

## Contributor Setup

This folder does not contain executable tool code yet. Until a feature issue
adds the implementation, contributors should use these local documents as the
launch contract:

- `specs.md` defines the behavior and ownership boundary.
- `docs/test-plan.md` lists the acceptance scenarios future unit and component
  tests should cover.
- `docs/fixtures.md` describes synthetic emails, snooze requests, and expected
  outcomes.
- `REVIEW_NOTES.md` gives reviewers a quick checklist for this isolated work.

## Intended Usage

The tool lets an individual user temporarily hide an email until a chosen time.
A future feature implementation should accept a normalized email and snooze
request, validate the target wake time, return a reviewable snooze draft, and
avoid mutating mailbox state until the user confirms.

## Known Limitations

- No production code is present in this folder yet.
- The documented tests are a plan, not an executable suite.
- Main app routing, inbox integration, and persistence are intentionally out of
  scope until a future integration issue allows them.
