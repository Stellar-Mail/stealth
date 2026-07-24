# Private Note on Email

This folder is the isolated workspace for the Private Note on Email tool.

## Ownership Boundary

All work for this tool must stay inside:

`tools/v2/individual/private-note-on-email/`

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

## Execution Contract & Entry Points

This tool exports a stable, non-UI execution contract:

- `safeAttachPrivateNote(input: unknown, options?: unknown)`: Safe entry point for untrusted callers that validates inputs, sanitizes note text, enforces limits, and never throws.
- `attachPrivateNote(input, options?)`: Pure deterministic service for attaching private notes to email messages.
- `successFixtures` & `failureFixtures`: Comprehensive fixtures for integration testing.

See [docs/contract.md](./docs/contract.md) for full input/output specifications, error codes, and service boundaries.
