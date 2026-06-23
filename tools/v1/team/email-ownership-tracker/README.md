# Email Ownership Tracker

Email Ownership Tracker is a folder-local team tool for tracking who currently owns a shared
inbox message and how ownership changed over time. The tool is isolated until a future integration
issue explicitly connects it to the main mail application.

## Ownership Boundary

All source, docs, tests, fixtures, and future local configuration for this tool must stay under:

```text
tools/v1/team/email-ownership-tracker/
```

Do not wire this tool into the main app shell, routing, inbox architecture, wallet core, Stellar
core, database schema, or shared design system unless a future integration issue explicitly allows
that work.

## Local Architecture Contract

- `components/` may render ownership queues, ownership history, empty/loading/error states, and
  handoff controls using folder-local props only.
- `services/` owns validation, ownership event normalization, timeline construction, and summary
  derivation.
- `hooks/` may adapt folder-local services into React state, but must not call global stores or
  live mail APIs.
- `fixtures/` stores synthetic ownership events and histories for deterministic tests.
- `tests/` contains folder-local unit, fixture, and architecture contract tests.
- `docs/` records architecture, contributor boundaries, safety assumptions, and integration notes.

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) and
[docs/CONTRIBUTOR_BOUNDARY.md](./docs/CONTRIBUTOR_BOUNDARY.md) for the detailed contract.
