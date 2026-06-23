# Email Template Library

This folder is the isolated workspace for the Email Template Library tool.

## Ownership Boundary

All work for this tool must stay inside:

`text
.\tools\v2\individual\email-template-library\
`

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

See specs.md for the issue categories and contributor expectations.

## Review Assets

- `TEST_PLAN.md` covers the folder-local checks for template listing, filtering, rendering, variable validation, and empty/error states.
- `REVIEW_NOTES.md` maps the issue acceptance criteria to files a reviewer can inspect without running the full app.
- `fixtures/template-library-fixtures.json` provides deterministic synthetic templates and preview values for manual or future automated tests.
