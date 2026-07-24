# SLA Deadline Tracker — Architecture

This document is the folder-local architecture plan for the SLA Deadline
Tracker (issue #449). It defines module boundaries, data ownership,
dependencies, and integration constraints. It does **not** modify the main
application and is intended to be reviewed as a self-contained mini-product
change. The functional core is implemented separately in #450
(`services/slaTracker.ts`); this document describes how the folder is organized
around that core and what future contributors may build on top of it.

## 1. Goal & scope

The tool monitors response-SLA status for a collection of tracked items
(emails, tickets, conversations). It is a **V1, team-audience** mini-product.
It is built in isolation and must not be wired into the main application until a
future integration issue explicitly allows it.

## 2. Folder layout

```
tools/v1/team/sla-deadline-tracker/
├── types/            # shared TypeScript contracts (no logic, no imports)
├── services/         # framework-free business logic (the SLA engine)
├── fixtures/         # deterministic local sample data (no production data)
├── hooks/            # (planned) React glue — NOT implemented yet
├── components/       # (planned) UI — NOT implemented yet
├── tests/            # vitest unit tests for services/fixtures
├── docs/             # CORE.md (engine notes), ARCHITECTURE.md (this file)
├── index.ts          # public API surface (re-exports types + engine)
├── vitest.config.ts  # isolated tool test config
└── specs.md          # tool specification + contributor change rules
```

The dependency flow is strictly one-way:

```
components/  →  hooks/  →  services/  →  types/
   (planned)      (planned)     (built)      (built)
```

Nothing outside this folder may be imported, and nothing inside this folder may
import from the main app.

## 3. Module boundaries

| Module        | Status  | Responsibility                                                                                                        | May import                                  |
| ------------- | ------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `types/`      | built   | Shared interfaces (`SlaTrackedItem`, `SlaPolicy`, `SlaEvaluation`, `SlaSummary`, `SlaStatus`). No logic.              | nothing                                     |
| `services/`   | built   | Pure, deterministic SLA engine (`evaluateSla`, `summarizeSla`, `computeDeadline`). Time injected for reproducibility. | `../types/` only                            |
| `fixtures/`   | built   | Deterministic sample items + standard policy for tests.                                                               | `../types/`                                 |
| `tests/`      | built   | vitest specs covering every status branch, determinism, large arrays.                                                 | `../services/`, `../fixtures/`, `../types/` |
| `hooks/`      | planned | Future React glue (loading/error state around the service).                                                           | React, `../services/`, `../types/`          |
| `components/` | planned | Future presentational UI (status badges, deadline lists).                                                             | `../hooks/`, `../types/`                    |

Full per-module contracts are in `MODULE_BOUNDARIES.md`.

## 4. Data ownership

- **Source of truth for policy:** `fixtures/sla.fixture.ts` ships a
  `STANDARD_SLA_POLICY` (4h response budget, 30m warn window). Real deployments
  will supply policy at call time; the engine never stores policy itself.
- **Items are caller-owned:** `SlaTrackedItem` records are produced and
  persisted by the _future integrating_ code. This folder only _reads_ them via
  the engine; it owns no storage, no database schema, and no network calls.
- **No PII leakage path:** the engine emits only status + numeric remaining
  time. It never serializes item bodies or recipient identities outside the
  folder.

## 5. Dependencies

- **Runtime deps:** none beyond TypeScript. No external SDK, no network client.
- **Test deps:** `vitest` (dev-only, via the folder's `vitest.config.ts`).
- **Forbidden:** any import crossing into `src/`, the app shell, routing, inbox
  architecture, wallet/Stellar core, or the design system.

## 6. Integration constraints

- The tool is **isolated until a future integration issue links it.** Do not add
  routes, navigation entries, or app-store wiring here.
- If a future issue connects this tool to the mail app, it must do so by
  importing the public API from `index.ts` and adapting items into
  `SlaTrackedItem` at the boundary — never by reaching into `services/`
  internals or mutating the engine's signatures.
- Time must always be supplied by the caller (`now` parameter) so evaluations
  stay deterministic and testable; do not introduce `Date.now()` inside the
  engine.

## 7. What future contributors may and may not change

See `specs.md` → "Contributor change rules" for the explicit allow/deny list.
