# Response Time Tracker Architecture

## Purpose

Response Time Tracker is a V2 team tool that measures how quickly shared
mailbox conversations receive a response. This architecture contract keeps the
tool reviewable as a folder-local mini-product until a future integration issue
explicitly connects it to live inbox data or app navigation.

## Folder Boundary

All modules for this tool live under:

```text
tools/v2/team/response-time-tracker/
```

The tool must not modify the main app shell, routing, inbox architecture, mail
rendering engine, authentication, wallet core, Stellar core, database schema, or
shared design system. Future integrations should import the folder's public API
and pass data or callbacks into it instead of letting this folder reach into
core application internals.

## Module Boundaries

### Public API

- `index.ts` is the only intended export surface.
- Exported components, hooks, services, and types should be stable enough for a
  future integration issue to consume.
- New public exports should be documented in the README before they are used by
  app-level code.

### Components

Path: `components/`

Components render the response-time dashboard: date range controls, metric
cards, list items, loading states, empty states, and error states. Components
may import local hooks, local types, and local child components only. They should
not fetch data directly or import app routes, inbox modules, wallet modules, or
shared UI components.

### Hooks

Path: `hooks/`

Hooks coordinate local state and service calls for the UI. They own loading,
empty, error, and success state transitions. Hooks should accept dependencies
through parameters when live data is introduced later, so tests can continue to
run against fixtures and mock services.

### Services

Path: `services/`

Services own deterministic response-time calculations, fixture loading,
date-range filtering, and team-member lookup. Services should stay UI-agnostic:
no React imports, no DOM reads, no routing, no network calls, and no database
writes in this isolated phase.

### Types

Path: `types.ts`

Types define the local contract for `ResponseTimeEntry`, `ResponseTimeMetrics`,
`TeamMember`, `DateRange`, and `FetchState`. Keep these types free of app-level
dependencies so they can act as the boundary between this folder and a future
integration wrapper.

### Fixtures

Path: `fixtures/`

Fixtures are small, synthetic data sets used for local review and tests. They
must not include real customer mail, production identifiers, secrets, wallet
addresses, private team rosters, or live message content.

### Tests

Path: `tests/`

Tests validate folder-local contracts without starting the main app. They should
cover metrics calculation, date filtering, fixture shape, and state transitions
as the tool grows. App-wide integration, auth, live inbox, and database tests
belong in a future issue.

### Docs

Path: `docs/`

Docs explain the tool contract, review process, test plan, and architecture
constraints. Any future contributor changing module boundaries should update
this file and the README documentation map in the same PR.

## Data Ownership

- The tool owns its local response-time entries, team-member fixtures, metrics,
  fetch state, and date-range selection.
- The tool does not own live mailbox storage, user identity, team membership,
  SLA policy administration, or persistence.
- A future integration should pass live entries into the service or hook layer
  through an adapter, then keep authorization and persistence outside this
  folder.

## Dependency Rules

Allowed inside this folder:

- Local imports within `response-time-tracker/`.
- React for component and hook implementation.
- Existing project build primitives that are already available to isolated
  tools.
- Node's built-in test runner for local tests.

Not allowed in this isolated phase:

- Imports from app routing or shell modules.
- Imports from inbox, mail renderer, auth, wallet, Stellar, or database layers.
- Writes to production storage.
- Network calls to live mailbox APIs.
- Shared design-system component imports unless a future integration issue
  explicitly introduces an adapter.

## Future Integration Contract

A future integration issue may mount the tracker by importing from `index.ts`
and passing one of these adapter shapes:

- a response-time entry provider that returns already-authorized entries;
- a team-member provider that resolves display names for local rendering;
- an SLA policy provider that can replace the current fixed 4-hour SLA;
- optional telemetry callbacks for non-sensitive UI errors.

That follow-up work should keep the adapter outside this folder or document why
it belongs here. It should not silently add app-level imports to components or
services.

## Review Checklist

- All changed files stay inside `tools/v2/team/response-time-tracker/`.
- `index.ts` remains the public boundary.
- Components do not fetch data directly.
- Services remain UI-agnostic and fixture-safe.
- Fixtures stay synthetic and small.
- README, specs, test plan, review notes, and this architecture contract agree
  on what is in scope.
