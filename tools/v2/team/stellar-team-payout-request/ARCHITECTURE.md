# Stellar Team Payout Request — Architecture

This document outlines the folder-local architecture plan for the Stellar Team Payout Request tool (issue #664). It defines module boundaries, data ownership, dependencies, and integration constraints. It does **not** modify the main application and is intended to be reviewed as a self-contained mini-product change.

## 1. Goal & scope

The tool allows team members to request payouts via Stellar. It is a **V2, team-audience** mini-product. It is built in isolation and must not be wired into the main application until a future integration issue explicitly allows it.

## 2. Folder layout

```
tools/v2/team/stellar-team-payout-request/
├── types/            # shared TypeScript contracts
├── services/         # business logic (payout validation, stellar request prep)
├── fixtures/         # deterministic local sample data
├── hooks/            # React glue
├── components/       # presentational UI
├── tests/            # vitest unit tests
├── docs/             # architectural notes
├── index.ts          # public API surface
└── specs.md          # tool specification
```

The dependency flow is strictly one-way:

```
components/  →  hooks/  →  services/  →  types/
```

Nothing outside this folder may be imported, and nothing inside this folder may import from the main app.

## 3. Module boundaries

See `MODULE_BOUNDARIES.md` for full definitions.

## 4. Data ownership

- **Source of truth for requests:** Local state / mock backend. In the future, requests will be managed by a database schema, but this folder owns no schema.
- **No PII leakage path:** Payout destinations and amounts should not leak beyond the service layer.
- **Wallet/Stellar core:** Must not interact with or mutate existing Stellar core services; any mocked Stellar responses will be defined in `fixtures/`.

## 5. Dependencies

- **Runtime deps:** none beyond TypeScript and React (future). No external SDK, no network client outside of allowed mocks.
- **Forbidden:** any import crossing into `src/`, the app shell, routing, inbox architecture, wallet/Stellar core, or the design system.

## 6. Integration constraints

- The tool is **isolated until a future integration issue links it.** Do not add routes, navigation entries, or app-store wiring here.
- Future integration must use the public API from `index.ts`.
