# Email Ownership Tracker

Email Ownership Tracker is an isolated V1 team tool engine for coordinating
which teammate owns a shared mailbox thread. It is not wired into the main mail
app yet.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v1/team/email-ownership-tracker/
```

Do not connect this tool to the app shell, dashboard navigation, inbox routing,
authentication, wallet code, Stellar integration, database schema, mail renderer,
or the shared design system unless a future integration issue explicitly allows
that work.

## Core API

- `OwnershipTrackerService` manages deterministic in-memory thread ownership.
- `claimThread(threadId, input)` assigns an unowned or released thread to a
  teammate.
- `releaseThread(threadId, input)` releases a thread only when requested by the
  current owner.
- `listThreads()` and `getThread(threadId)` return defensive copies.
- `getHistory(threadId?)` exposes folder-local ownership events for review.

## State Model

Thread ownership can be:

- `unassigned` before anyone claims the thread.
- `assigned` while a teammate owns the thread.
- `released` after the current owner gives it back to the team queue.

Loading state is expected to be handled by a future UI or integration layer. The
current engine is synchronous and deterministic so it can be tested without live
mailbox data, network calls, or production secrets.

## Review

Run the folder-local service test when project dependencies are available:

```bash
npx vitest run tools/v1/team/email-ownership-tracker/tests/service.test.ts
```

The fixtures in `fixtures/ownership-cases.ts` use public-safe `.test` senders.
