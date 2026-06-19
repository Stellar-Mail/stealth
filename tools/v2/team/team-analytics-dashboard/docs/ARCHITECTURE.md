# Team Analytics Dashboard Architecture

This folder is a self-contained mini-product contract for the Team Analytics
Dashboard. It describes the module boundaries that future contributors must
preserve while the tool remains isolated from the main app.

## Product Intent

The tool provides folder-local analytics fixtures, validation tests, and
architecture notes for a future dashboard that will summarize team workload,
response time, SLA pressure, and review needs.

The current issue does not implement the dashboard UI or any app integration.

## Ownership Model

- Owned by this folder: synthetic fixtures, local test contracts, and local
  documentation.
- Not owned by this folder: the main app shell, routing, inbox architecture,
  wallet core, Stellar core, database schema, shared design system, or auth.
- Future integration work must be tracked by a separate issue before any core
  app wiring is introduced.

## Module Boundaries

### `components/`

- Future presentational components for charts, tables, cards, and empty states.
- Only local UI pieces belong here.
- Do not import shared app shell components or modify the global design system.

### `services/`

- Future local analytics aggregation, normalization, and mapping logic.
- Allowed to consume local fixtures and pure helper functions only.
- Must not talk to live inbox services, database clients, wallet code, or Stellar code.

### `hooks/`

- Future view-state and data-access hooks for the dashboard experience.
- Keep these hooks local to the folder and service-backed only.
- Do not couple them to application routing or global state containers.

### `tests/`

- Contract tests for fixtures, data shape, threshold rules, and review cases.
- Tests should remain runnable with Node's built-in test runner where possible.
- Future UI tests may be added here only if they stay folder-local.

### `docs/`

- Architecture notes, test plans, review notes, and contributor boundaries.
- This is the primary place to explain what can change and what must stay put.

## Data Ownership

The analytics fixture owns the local source of truth for:

- reporting period metadata
- team identifier
- member-level workload metrics
- summary rollups
- review-required identifiers

The fixture is intentionally synthetic. It does not represent production data,
and it must not be treated as a live sync target.

## Dependencies

Allowed dependencies:

- Node built-ins for test execution
- Local fixture files under `fixtures/`
- Folder-local helpers under `services/`, `hooks/`, and `components/`

Disallowed dependencies:

- Main app shell and navigation
- Shared inbox rendering or mail transport logic
- Wallet, Stellar, or database infrastructure
- Shared design system edits

## Future Change Rules

Future contributors may:

- add local fixture variations
- add more local validation tests
- add folder-local components, hooks, or services
- improve documentation inside this folder

Future contributors may not:

- connect the tool to production mail data
- modify the main app shell or routing
- change the inbox architecture or wallet/Stellar core
- alter the database schema
- update shared design system files

## Follow-Up Work

If this tool eventually needs live data or app registration, that work should be
split into a separate integration issue with explicit approval to touch the main
application boundaries.
