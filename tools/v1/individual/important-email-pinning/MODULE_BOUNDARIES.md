# Important Email Pinning Module Boundaries

This folder is the complete architecture boundary for the V1 individual Important Email Pinning tool. Future work must keep implementation, fixtures, tests, and documentation inside this directory until an explicit integration issue expands the scope.

## Folder Contract

```text
tools/v1/individual/important-email-pinning/
├── README.md
├── specs.md
├── MODULE_BOUNDARIES.md
├── DATA_OWNERSHIP.md
├── INTEGRATION_CONSTRAINTS.md
├── REVIEW_NOTES.md
├── components/
├── services/
├── hooks/
├── tests/
└── docs/
```

The `components/`, `services/`, `hooks/`, and `tests/` directories may be added by future issues when code is implemented. They must remain folder-local and may not import from unpublished app internals.

## Components Boundary

Components own only the local review experience for important email pins:

- pin and unpin controls;
- reason viewing and editing affordances;
- active, expired, empty, loading, and error states;
- local list presentation for pinned message summaries.

Components must not own mailbox rendering, global navigation, dashboard layout, authentication, wallet UI, Stellar transaction UI, or shared design-system changes. If a component needs host application styling, the integration issue must provide an adapter instead of changing the design system from this folder.

## Services Boundary

Services own deterministic pinning decisions over supplied inputs:

- normalizing synthetic or host-provided message summaries;
- creating, updating, expiring, and clearing local pin records;
- preventing duplicate active pins for the same `messageId`;
- sorting pinned summaries by active state, expiry urgency, and created time;
- exposing pure functions that can be tested with local fixtures.

Services must not archive, delete, label, forward, reply to, send, or mark email as read. Services must not call production mail APIs, database clients, wallet clients, Stellar clients, analytics clients, or external AI services in V1 baseline work.

## Hooks Boundary

Hooks may coordinate component state with folder-local services:

- tracking selected message ids and pin actions;
- deriving active and expired pin views;
- exposing callback shapes for future host adapters;
- maintaining temporary in-memory state for demos and tests.

Hooks must not subscribe to main app stores, router state, authenticated user sessions, inbox caches, wallet state, or database listeners until a future integration issue defines the adapter contract.

## Tests Boundary

Tests must use folder-local fixtures and synthetic messages. They should verify:

- explicit manual pinning and unpinning;
- duplicate prevention;
- expiry behavior;
- deterministic sorting;
- accessible state labels and keyboard-reachable controls;
- no mailbox mutation side effects.

Tests must not require real mailboxes, real user data, production credentials, network access, or a running main application shell.

## Docs Boundary

Docs in this folder are the source of truth for V1 contributor expectations. Future contributors may refine the pinning model, add local examples, or add local tests here. They may not use this folder to justify changes outside this directory without a separate integration issue.
