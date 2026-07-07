# Customer Support Macro Tool - Data Ownership

This document defines owned data, runtime state, storage boundaries, and future
adapter rules for the folder-local Customer Support Macro Tool.

## Owned Data

| Data                                      | Owner                         | Source                                              | Mutation Rule                                                               |
| ----------------------------------------- | ----------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------- |
| `Macro`                                   | `services/macro.service.ts`   | Fixture seed, caller input, or storage adapter data | Service functions return copied objects or arrays and do not mutate inputs. |
| `MacroStore`                              | `services/macro.service.ts`   | Local macro arrays                                  | Treated as an in-memory shape, not a server schema.                         |
| `MacroCreateInput` and `MacroUpdateInput` | `services/macro.service.ts`   | User or caller input                                | Validated locally before save.                                              |
| `MacroSearchOptions`                      | `services/macro.service.ts`   | Hook or caller state                                | Used only for local filtering.                                              |
| `StorageAdapter`                          | `services/storage.service.ts` | Browser localStorage or in-memory adapter           | Adapter writes are scoped to `csmt_macros_v1`.                              |
| Hook state                                | `hooks/useMacros.ts`          | Local React state                                   | Persisted only through the provided adapter.                                |

## Runtime State

The current tool owns only local state:

- Macro arrays in `useMacros()`.
- Search options, sort key, and sort direction in `useMacros()`.
- Browser localStorage values under `csmt_macros_v1` when the default adapter is
  used.
- In-memory adapter maps for tests.
- Fixture macro arrays for local test and review.

The tool does not own:

- Live inbox messages.
- Compose drafts.
- Sent mail.
- Ticket records.
- Customer profiles.
- Team permissions.
- Server database rows.
- Notification delivery state.
- Wallet accounts.
- Stellar transactions.

## Lifecycle

```text
Seed fixtures or adapter-loaded macros
    -> useMacros() state
    -> macro.service.ts pure operation
    -> new macro array
    -> saveMacros(adapter)
    -> local adapter storage only
```

No step writes to server APIs, shared app stores, queues, databases, inbox
state, compose state, notification services, wallet state, or Stellar ledgers.

## Fixture Rules

- Fixture macros are synthetic examples for tests and local development.
- Fixture text must not include real customers, tickets, orders, invoices,
  secrets, API keys, access tokens, or production email content.
- Tests may import fixtures but must not write back to fixture files.
- New fixtures should stay small and reviewable.

## Storage Ownership

`services/storage.service.ts` owns the current persistence boundary:

- `localStorageAdapter` uses browser `localStorage` when available.
- `createInMemoryAdapter()` supports tests and isolated review.
- `loadMacros()` safely falls back to an empty array for missing or malformed
  data.
- `saveMacros()` serializes only macro arrays.
- `clearMacros()` removes only the tool storage key.

Storage does not represent a database schema, team-sharing protocol, or
cross-device sync model. Any server-backed storage requires a separate
integration issue.

## Hook Ownership

`hooks/useMacros.ts` owns local UI state orchestration:

- It seeds local state from fixtures when storage is empty.
- It persists macro state through the selected storage adapter.
- It exposes add, edit, remove, favorite, use, search, sort, and validate
  actions.

The hook does not own routing, permissions, user identity, team membership,
compose insertion, inbox mutation, or mail sending.

## Future Integration Adapter Boundary

If a later issue connects this tool to live app data, it must add an explicit
adapter or wrapper layer and review:

- Agent authentication and team authorization.
- Server persistence and sync conflict handling.
- Audit history and retention rules.
- Compose-window insertion behavior.
- Variable prompts for missing customer or ticket values.
- Privacy rules for macro content copied from real support threads.
- Rate limits and provider error handling if remote storage is used.

The current architecture issue documents those boundaries but does not implement
the adapter.

## Privacy and Security Constraints

- Do not log real support replies, customer details, or ticket content.
- Do not include secrets, tokens, API keys, wallet data, production IDs, or real
  customer data in fixtures.
- Do not send macro output automatically.
- Do not persist macros outside the configured local adapter.
- Keep future error messages structural and non-sensitive.
