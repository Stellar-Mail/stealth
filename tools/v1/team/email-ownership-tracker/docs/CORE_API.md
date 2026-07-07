# Email Ownership Tracker Core API

## Purpose

The core engine models folder-local ownership history for shared team mailbox
threads. It is intentionally isolated: no inbox reads, mailbox writes,
notifications, persistence, routes, auth, wallet, Stellar, database, provider
calls, production data, secrets, or app-shell integration.

## Public Helpers

`core/ownership-engine.mjs` exports:

- `normalizeOwnershipEvent(event)` to validate and normalize one ownership event.
- `buildOwnershipLedger(events)` to derive active owners and conflicts from a
  bounded event history.
- `createOwnershipState(result, options)` to map ledger data into loading,
  empty, ready, or error states for a future UI.
- `createOwnershipEngine(initialEvents, options)` to create an in-memory,
  deterministic service surface for claim, release, transfer, list, and ledger
  operations.

## Inputs

Ownership events are plain objects:

```text
eventId: stable folder-local id
messageId: safe thread or message id
action: claim, release, or transfer
actorEmail: user making the change
ownerEmail: current or requested owner
nextOwnerEmail: transfer target
createdAt: ISO timestamp
subject: optional display subject
reason: optional handoff note
```

The engine rejects unsafe ids, malformed emails, unsupported actions, malformed
timestamps, non-array histories, and histories larger than 500 events.

## Outputs

`buildOwnershipLedger` returns:

```text
status: ready
activeOwners: current owner summaries sorted by messageId
conflicts: rejected claim, release, or transfer attempts
summary: totalEvents, activeOwners, conflicts
```

`createOwnershipState` returns one of:

- `loading` while a future adapter is loading history.
- `empty` when no active owners exist.
- `ready` when active owner summaries are available.
- `error` when validation or future adapter work fails.

## Core Behavior

- `claim` assigns an unowned message to an owner.
- duplicate claims by the same owner are idempotent history updates.
- claims by a different owner produce an `already-owned` conflict.
- `release` clears ownership only when requested by the current owner.
- `transfer` moves ownership only when requested by the current owner.
- all returned events and ledger snapshots are defensive copies.

## Review Notes

This issue adds only a local core engine. Future UI and integration issues should
call the engine through folder-local adapters and must document any product data
ownership before writing to inbox state, notifications, persistence, or analytics.
