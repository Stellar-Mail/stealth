# Shared Team Inbox — Core Engine

This folder contains the folder-local **core feature engine** for the Shared
Team Inbox (issue #445). Built in isolation per the tool's `specs.md`; it is not
wired into the main application.

## What the engine provides

- `createTeamInbox(seed?)` — swappable in-memory store (reference adapter).
- Message ingestion with duplicate-id guard.
- Claim / release ownership with visible `assignee` state.
- A triage state machine: `unassigned → claimed → in-progress →
awaiting-reply → resolved` (plus re-open from `resolved`).
- Team-only annotation threads (`annotate`) — by contract these are
  **sender-invisible** and must never be included in an external reply.
- Team replies recorded under the shared identity (`reply`) — recorded only;
  no external sending happens here.
- `list(status?)` querying.

## Files

- `types/index.ts` — `TeamMessage`, `TriageRecord`, `Annotation`, `TeamReply`,
  `TriageStatus`.
- `services/inboxEngine.ts` — pure engine + `TriageTransitionError`,
  `isAllowedTransition`.
- `fixtures/inbox.fixtures.ts` — deterministic sample messages + seed record.
- `tests/inboxEngine.test.ts` — 10 tests (state machine, annotations, replies,
  guards, listing).
- `index.ts` — public API surface.

## Constraints honored

- No live network calls, secrets, or production data.
- No imports from `src/`, `tools/v2/`, or sibling tools.
- Files changed limited to `tools/v1/team/shared-team-inbox/`.
- Reviewable as a self-contained mini-product change.
