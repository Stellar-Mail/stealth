# Email Ownership Tracker Architecture Plan

## Folder Boundary

All code, tests, fixtures, and notes for this tool live under:

```text
tools/v1/team/email-ownership-tracker/
```

This V1 team tool must stay isolated until a future integration issue explicitly
connects it to the mail product. This architecture issue does not modify the app
shell, dashboard layout, routing, inbox architecture, mail rendering engine,
authentication, wallet core, Stellar core, database schema, notification system,
or shared design system.

## Module Map

The intended mini-product is split into folder-local layers:

| Layer      | Planned path  | Responsibility                                                         |
| ---------- | ------------- | ---------------------------------------------------------------------- |
| Public API | `index.ts`    | Re-export stable tool contracts only.                                  |
| Types      | `types/`      | Define ownership events, owners, teams, history windows, and UI state. |
| Services   | `services/`   | Own pure ownership-history operations and in-memory adapters.          |
| Guards     | `guards/`     | Validate unsafe input before services, hooks, storage, or rendering.   |
| Hooks      | `hooks/`      | Bridge services to React state without importing app stores.           |
| Components | `components/` | Render the isolated tracker surface and accessibility states.          |
| Fixtures   | `fixtures/`   | Provide deterministic local data for tests and review.                 |
| Tests      | `tests/`      | Verify contracts, data boundaries, and behavior without app wiring.    |
| Docs       | `docs/`       | Explain ownership, integration constraints, and review checklists.     |

## Data Flow

The tool should use a one-way ownership flow:

```text
mail event snapshot
  -> guards validate ids, emails, tags, attachments, and timestamps
  -> services normalize ownership events and derive current owners
  -> hooks expose loading, empty, error, and ready states
  -> components render local state without mutating mailbox data
```

The current architecture contract does not add persistence, app routes, mailbox
mutation, notification delivery, or live network calls. Future feature issues can
add those adapters only through folder-local boundaries and should document the
new trust assumptions before wiring them.

## Internal Contracts

Public API:

- expose stable type names, service factories, and guard helpers through
  `index.ts` only after the related implementation issue lands.
- do not re-export fixtures, tests, or private helper functions.

Types:

- use plain serializable objects for ownership events and owner summaries.
- represent timestamps as UTC ISO strings.
- avoid importing main app types from `src/`.

Services:

- accept already-guarded inputs and return copied data.
- keep ownership derivation deterministic for the same event order.
- paginate or window histories before expensive derivation.
- do not call network APIs, wallet APIs, database clients, or notification
  senders.

Guards:

- reject unsafe ids, malformed emails, unsupported actions, invalid timestamps,
  oversized histories, unsafe tags, and malformed attachment metadata.
- remain pure and synchronous unless a future issue explicitly adds async
  validation.

Hooks:

- own only local UI state and invoke folder-local services.
- expose explicit `idle`, `loading`, `ready`, `empty`, and `error` states.
- avoid importing app stores, route state, auth state, wallet state, or inbox
  internals.

Components:

- render from hook state and props only.
- include accessible names, focus behavior, and status regions for async states.
- do not edit the shared design system or app shell.

Fixtures and tests:

- keep data synthetic and deterministic.
- cover malformed input, large histories, empty ownership states, and handoff
  notes.
- use local Node or Vitest tests that can run without product integration.

## Contributor Change Spec

Future contributors may:

- add files under this tool folder to complete feature, UI, security, and test
  issues.
- add folder-local fixtures, docs, tests, services, hooks, and components.
- update this plan when a future issue changes module ownership.

Future contributors may not:

- modify `src/`, app routes, dashboard shell, inbox architecture, auth, wallet,
  Stellar, database schema, notification providers, or shared UI primitives from
  this issue.
- introduce production data, secrets, paid services, live provider calls, or
  mailbox mutations.
- make this tool depend on another isolated tool folder.

## Review Checklist

- All changed files stay under `tools/v1/team/email-ownership-tracker/`.
- Architecture docs define components, services, hooks, tests, fixtures, and docs.
- Data ownership and dependency limits are explicit.
- No app integration code is added.
- Tests can verify the architecture contract without running the main app.
