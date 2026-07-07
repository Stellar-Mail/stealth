# Email Ownership Tracker Data Boundaries

## Owned Data

The isolated tool owns only synthetic or caller-provided data structures:

- ownership event snapshots.
- current-owner summaries derived from those snapshots.
- local team member references used by the tracker UI.
- attachment metadata, not attachment file bodies.
- local UI state such as loading, empty, error, and ready views.
- deterministic fixtures used by folder-local tests.

The tool does not own mailbox records, account identities, auth sessions,
wallet accounts, Stellar transactions, database rows, notification jobs, or
provider credentials.

## Boundary Rules

Input enters the tool as plain objects. Guards should validate shape, size, and
unsafe characters before any service, hook, component, or future adapter uses the
data. Services should return copied summaries and should not expose internal
mutable collections.

The tool must not write to an inbox, change message assignment state in the main
mail product, send notifications, persist records, or call a provider from this
architecture issue. Future integration work must document the owner of each
adapter before connecting it.

## Dependency Rules

Allowed dependencies:

- JavaScript and TypeScript standard language features.
- React only inside future `components/` and `hooks/` files.
- Existing project test tools for folder-local tests.
- Existing shared UI primitives only when a future UI issue permits components.

Forbidden dependencies for this architecture issue:

- imports from `src/features/`, `src/routes/`, app stores, inbox internals, auth,
  wallet, Stellar, database, or notification modules.
- imports from other isolated tool folders.
- new npm packages, paid APIs, cloud services, wallet signatures, or production
  credentials.

## Future Adapter Handoff

A future integration issue should create an adapter checklist before touching
product data:

1. identify the source mailbox event and its owner.
2. run guard helpers before transforming the event.
3. limit history windows and team member lists.
4. return copied summaries to UI code.
5. keep writes behind a separately reviewed ownership-write issue.
6. document any new persistence or notification behavior in this folder first.
