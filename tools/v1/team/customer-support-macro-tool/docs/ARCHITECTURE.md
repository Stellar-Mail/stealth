# Customer Support Macro Tool - Architecture Contract

This document defines the module boundaries, dependency rules, data flow, and
future integration constraints for the Customer Support Macro Tool. The tool is
a self-contained V1 team mini-product and must remain isolated in
`tools/v1/team/customer-support-macro-tool/`.

## Ownership Boundary

All source, fixtures, tests, and docs for this issue stay inside:

```text
tools/v1/team/customer-support-macro-tool/
```

This tool does not modify or depend on the main application shell, dashboard
layout, routing, inbox architecture, mail rendering engine, compose-send flow,
authentication, wallet core, Stellar core, database schema, notification
delivery, provider SDKs, or shared design system.

## Folder Structure

```text
tools/v1/team/customer-support-macro-tool/
|-- README.md
|-- specs.md
|-- vitest.config.ts
|-- docs/
|   |-- ARCHITECTURE.md
|   |-- DATA_OWNERSHIP.md
|   |-- REVIEW_NOTES.md
|   `-- SETUP.md
|-- fixtures/
|   `-- macros.fixture.ts
|-- hooks/
|   `-- useMacros.ts
|-- services/
|   |-- macro.service.ts
|   `-- storage.service.ts
`-- tests/
    |-- TEST_PLAN.md
    |-- architecture-contract.test.mjs
    |-- macro.helpers.test.ts
    |-- macro.service.test.ts
    `-- storage.service.test.ts
```

A future `components/` module may be added by a UI-specific issue, but this
architecture issue does not mount the tool in the app shell.

## Module Boundaries

### Macro Service: `services/macro.service.ts`

The macro service owns pure business logic:

- Macro creation, updates, deletion, and usage count updates.
- Search, category filtering, tag filtering, favorite filtering, and sorting.
- Variable extraction and interpolation.
- Input validation for title, body, and category.

Service rules:

- No React imports.
- No network calls.
- No persistence writes.
- No production inbox reads.
- No mutation of input arrays or fixture modules.
- No imports from `src/`, app routes, inbox modules, compose modules, auth,
  wallet, Stellar, database, notification, provider, or sibling tool modules.

### Storage Service: `services/storage.service.ts`

The storage service owns the folder-local persistence adapter boundary:

- `StorageAdapter` defines `getItem`, `setItem`, and `removeItem`.
- `localStorageAdapter` is a browser-local adapter.
- `createInMemoryAdapter()` is for tests and non-browser review.
- `loadMacros`, `saveMacros`, and `clearMacros` serialize macro arrays through
  the adapter.

Storage rules:

- The current V1 storage is local browser storage or in-memory test storage.
- No server database, queue, API route, or shared app store is introduced here.
- Future server-backed storage must use a separate integration issue.

### Hook Layer: `hooks/useMacros.ts`

The hook owns local React state orchestration:

- Loads macros from an explicit storage adapter.
- Seeds from local fixtures when storage is empty.
- Persists state changes through the selected adapter.
- Exposes CRUD, usage, search, sort, and validation actions.

Hook rules:

- The hook may import React and folder-local services only.
- The hook must not import app stores, routes, inbox state, auth state, or
  compose-window internals.
- Integration must happen through adapter options or a future wrapper, not by
  changing the hook to depend on app globals.

### Fixture Layer: `fixtures/`

Fixtures are local examples for tests and development. They must not contain
real customers, real ticket ids, real order ids, secrets, API keys, production
email content, or private support data.

### Test Layer: `tests/`

Tests verify:

- Macro service CRUD, search, sorting, validation, and interpolation behavior.
- Storage adapter load, save, clear, and round-trip behavior.
- Architecture contract, required docs, import isolation, and forbidden
  integration imports.

### Documentation Layer: `docs/`

Docs own reviewer guidance, architecture boundaries, data ownership rules, and
setup notes. Future integration plans belong in docs until a separate issue
explicitly allows code wiring.

## Data Flow

```text
Fixture seed or storage adapter data
    -> useMacros() local state
    -> macro.service.ts pure operations
    -> updated macro array
    -> storage.service.ts adapter persistence
    -> UI or caller receives derived macro state
```

Macro interpolation has a separate pure flow:

```text
Macro body + variable map
    -> interpolateMacro()
    -> rendered response text
    -> caller decides whether to insert it into a compose surface
```

The current flow does not send mail, mutate inbox threads, create tickets,
write server records, notify users, call providers, or touch wallet/Stellar
state.

## Dependency Rules

Allowed:

- Relative imports that resolve inside `tools/v1/team/customer-support-macro-tool/`.
- React imports in `hooks/`.
- Vitest imports in tests.
- Node built-ins in contract tests.
- TypeScript type-only imports inside this folder.

Not allowed:

- `src/` imports or aliases such as `@/`.
- Imports from sibling tools or parent directories that escape this folder.
- Main app routing, dashboard, inbox, compose, auth, wallet, Stellar, database,
  notification, provider, or design-system modules.
- New npm dependencies for this architecture issue.
- Live network calls, secrets, production credentials, provider SDKs, webhooks,
  or background jobs.

## Future Contributor Contract

Contributors may:

- Add local tests, fixtures, and docs.
- Refine macro validation, interpolation, search, and sorting rules with
  matching tests.
- Add future `components/` files inside this folder when scoped to a UI issue.
- Add adapter implementations when they remain explicit and folder-local.

Contributors may not:

- Wire this tool into application routes, navigation, inbox views, or compose
  surfaces.
- Persist macros to a server database or shared app store in this issue.
- Send mail, create tickets, deliver notifications, call provider SDKs, or run
  background sync.
- Connect to authentication, wallet flows, Stellar transactions, or payment
  features.
- Change shared design-system files or global app state.
- Modify files outside this folder for this issue.

## Review Checklist

- [ ] All changed files are under `tools/v1/team/customer-support-macro-tool/`.
- [ ] `specs.md`, `docs/ARCHITECTURE.md`, and `docs/DATA_OWNERSHIP.md` agree
      on the folder boundary.
- [ ] No relative imports resolve outside this folder.
- [ ] No main app routing, inbox, compose, auth, wallet, Stellar, database,
      provider, notification, or design-system wiring is introduced.
- [ ] `node --test tools/v1/team/customer-support-macro-tool/tests/architecture-contract.test.mjs`
      passes.
- [ ] Existing Vitest suites still pass.

## Acceptance Criteria Mapping

| Issue Requirement                                                                | Evidence                                                            |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Clear folder-local architecture plan                                             | This document and `specs.md`                                        |
| No main app, routing, inbox, wallet, Stellar, database, or design-system changes | Dependency rules and contract test                                  |
| Specs explain future contributor boundaries                                      | `specs.md` and Future Contributor Contract                          |
| Files changed are limited to this folder                                         | Git diff and contract test                                          |
| Self-contained mini-product review                                               | README, docs, fixtures, services, hooks, and tests are folder-local |
