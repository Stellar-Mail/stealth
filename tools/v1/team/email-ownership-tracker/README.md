# Email Ownership Tracker

This folder is the isolated workspace for the Email Ownership Tracker tool.

## Ownership Boundary

All work for this tool must stay inside:

`text
.\tools\v1\team\email-ownership-tracker\
`

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

See specs.md for the issue categories and contributor expectations.

## Review and test documentation

- [Setup guide](./docs/SETUP.md)
- [OSS review notes](./docs/REVIEW_NOTES.md)
- [Folder-local test plan](./tests/TEST_PLAN.md)

This contribution documents the review path for ownership history behavior
without wiring the tool into the main application.
