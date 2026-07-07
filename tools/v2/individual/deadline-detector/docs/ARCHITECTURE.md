# Deadline Detector - Architecture Contract

This document defines the folder-local architecture, dependency rules, data
flow, and future integration constraints for the Deadline Detector. The tool is
a self-contained V2 individual mini-product and must remain isolated in
`tools/v2/individual/deadline-detector/`.

## Ownership Boundary

All source, fixtures, tests, and docs for this issue stay inside:

```text
tools/v2/individual/deadline-detector/
```

This tool does not modify or depend on the main application shell, dashboard
layout, routing, inbox architecture, mail rendering engine, authentication,
wallet core, Stellar core, database schema, reminder scheduling, calendar
providers, notification delivery, or shared design system.

## Folder Structure

```text
tools/v2/individual/deadline-detector/
|-- index.ts
|-- README.md
|-- specs.md
|-- components/
|   |-- DeadlineDetectorEmptyState.tsx
|   |-- DeadlineDetectorErrorState.tsx
|   |-- DeadlineDetectorLoadingState.tsx
|   |-- DeadlineDetectorSummary.tsx
|   |-- DeadlineDetectorTool.tsx
|   |-- DeadlineResultCard.tsx
|   `-- index.ts
|-- docs/
|   |-- ACCESSIBILITY.md
|   |-- ARCHITECTURE.md
|   |-- DATA_OWNERSHIP.md
|   |-- TEST_PLAN.md
|   `-- VISUAL_STYLE.md
|-- fixtures/
|   `-- sample-deadline-messages.json
|-- services/
|   |-- deadline-detector.service.ts
|   `-- index.ts
|-- tests/
|   |-- architecture-contract.test.mjs
|   `-- deadline-fixtures.test.mjs
`-- types/
    |-- deadline.ts
    `-- index.ts
```

A future `hooks/` module may be added inside this folder by a UI/state issue,
but this architecture issue does not require one.

## Module Boundaries

### Public API: `index.ts`

`index.ts` is the folder-local public import surface. It exports:

- `DeadlineDetectorTool`
- `detectDeadlines`
- `sortDetectedDeadlines`
- Deadline domain types from `types/`

It must not re-export fixtures as stable API, expose provider SDKs, or import
from app routing, inbox, reminder, calendar, wallet, Stellar, or database
modules.

### Types: `types/`

`types/deadline.ts` owns the stable domain contracts:

- `DeadlineMessage`
- `DetectedDeadline`
- `DeadlineDetectionResult`
- `DeadlineDetectionSummary`
- `DeadlineDetectorServiceOptions`
- status, urgency, source, and id aliases

Types are plain TypeScript definitions. They must not import runtime code,
application auth state, database entities, mailbox thread models, calendar
provider records, or reminder scheduler models.

### Service Layer: `services/`

`deadline-detector.service.ts` owns the deterministic detection engine:

- Normalizes ISO dates, US dates, simple relative phrases, and 24-hour times.
- Classifies rows as `detected`, `needs-review`, `missed`, or `ignored`.
- Computes urgency and confidence from local message text and the supplied
  `now` option.
- Sorts urgent and overdue rows before lower-priority rows.

Service rules:

- No network calls.
- No persistence writes.
- No production mailbox reads.
- No calendar, reminder, notification, or scheduling side effects.
- No mutation of input arrays or fixture files.
- No imports from `src/`, app routes, inbox modules, reminder modules, calendar
  modules, wallet modules, Stellar modules, database modules, or sibling tools.

### Component Layer: `components/`

Components own local presentation only:

- `DeadlineDetectorTool` orchestrates local view state and filtering.
- Empty, loading, error, summary, and result card components render accessible
  states.
- Reminder and review actions are callback props and do not perform writes by
  themselves.

Component rules:

- Components may use React, lucide icons, local services, and local types.
- Components must not import app routes, inbox stores, reminder writers,
  calendars, auth, wallet, Stellar, or database clients.
- Components must not create reminders, mutate messages, schedule jobs, or
  persist data directly.

### Fixture Layer: `fixtures/`

Fixtures are synthetic examples for tests and local review. They must not
contain real senders, production mailbox content, API keys, tokens, secrets, or
personal data.

### Test Layer: `tests/`

Tests verify:

- Fixture schema and expected deadline outcomes.
- Required docs, module boundary claims, relative import isolation, and absence
  of forbidden integration imports.
- No broken generation/template leftovers in docs.

Node-compatible tests are preferred for lightweight contributor review.

### Documentation Layer: `docs/`

Docs own contributor guidance, data boundaries, accessibility notes, visual
style notes, and test guidance. Future integration details belong in docs until
a separate integration issue explicitly allows code wiring.

## Data Flow

```text
Synthetic fixtures or caller-provided DeadlineMessage[]
    -> detectDeadlines(messages, options)
    -> normalize date and time signals from local text
    -> classify status, urgency, confidence, and review requirement
    -> sortDetectedDeadlines()
    -> DeadlineDetectionResult { deadlines[], summary }
    -> DeadlineDetectorTool renders reviewable candidates
```

The current flow does not perform real fetches, writes, background jobs,
notifications, reminders, calendar updates, mailbox mutations, or provider
calls.

## Dependency Rules

Allowed:

- Relative imports that resolve inside `tools/v2/individual/deadline-detector/`.
- React and lucide icon imports in component files.
- Node built-ins in tests.
- TypeScript type-only imports inside this folder.

Not allowed:

- `src/` imports or aliases such as `@/`.
- Imports from sibling tools or parent directories that escape this folder.
- Main app routing, dashboard, inbox, reminder, calendar, auth, wallet, Stellar,
  database, or design-system modules.
- New npm dependencies for this architecture issue.
- Live network calls, secrets, production credentials, or provider SDKs.

## Future Contributor Contract

Contributors may:

- Add local tests, fixtures, and docs.
- Refine deterministic parsing rules while preserving documented output shapes.
- Extend components inside this folder when behavior remains callback-driven.
- Add a future folder-local `hooks/` module for UI state if a scoped issue asks
  for it.

Contributors may not:

- Wire this tool into application routes, navigation, inbox views, or dashboards.
- Persist deadline outputs to a database, browser storage, calendar, or reminder
  scheduler.
- Connect to live inbox APIs, calendar providers, notification providers,
  authentication, wallet flows, or Stellar transactions.
- Change shared design-system files or global app state.
- Modify files outside this folder for this issue.

## Review Checklist

- [ ] All changed files are under `tools/v2/individual/deadline-detector/`.
- [ ] `README.md`, `specs.md`, `docs/ARCHITECTURE.md`, and
      `docs/DATA_OWNERSHIP.md` agree on the folder boundary.
- [ ] No relative imports resolve outside this folder.
- [ ] No main app routing, inbox, reminder, calendar, auth, wallet, Stellar,
      database, provider, or design-system wiring is introduced.
- [ ] `node --test tools/v2/individual/deadline-detector/tests/architecture-contract.test.mjs`
      passes.
- [ ] Existing fixture tests still pass.

## Acceptance Criteria Mapping

| Issue Requirement                                                                | Evidence                                                                        |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Clear folder-local architecture plan                                             | This document and `specs.md`                                                    |
| No main app, routing, inbox, wallet, Stellar, database, or design-system changes | Dependency rules and contract test                                              |
| Specs explain future contributor boundaries                                      | `specs.md` and Future Contributor Contract                                      |
| Files changed are limited to this folder                                         | Git diff and contract test                                                      |
| Self-contained mini-product review                                               | README, docs, fixtures, services, components, types, and tests are folder-local |
