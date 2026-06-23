# SLA Deadline Tracker

SLA Deadline Tracker is a folder-local team tool for monitoring response deadlines on shared
mail workflows. It is not mounted in the main application and does not touch routing, wallet,
mail rendering, database, Stellar core, or the shared design system.

## Ownership Boundary

All source, docs, tests, fixtures, and future local configuration for this tool must stay under:

```text
tools/v1/team/sla-deadline-tracker/
```

Future integration work must be handled by a separate issue before this tool can call main app
services, read production inbox state, or write to shared application stores.

## Local Architecture Contract

- `components/` may render deadline queues, filters, empty/loading/error states, and escalation
  controls using props from folder-local hooks or services only.
- `services/` owns pure deadline calculation, validation, and in-memory reference behavior.
- `hooks/` may adapt service outputs for React state, but must not call global app stores.
- `fixtures/` stores synthetic deadline records and SLA policies for deterministic tests.
- `tests/` contains folder-local unit, contract, and fixture tests.
- `docs/` records architecture, ownership, safety, performance, and future integration notes.

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) and
[docs/CONTRIBUTOR_BOUNDARY.md](./docs/CONTRIBUTOR_BOUNDARY.md) for the detailed contract.
