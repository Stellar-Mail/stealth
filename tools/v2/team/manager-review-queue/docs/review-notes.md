# Reviewer Notes - Manager Review Queue

Use this checklist to review the isolated Manager Review Queue work without
connecting it to the main app.

## Quick Checks

- All changed files stay inside `tools/v2/team/manager-review-queue/`.
- Guard tests pass:

```bash
node --test tools/v2/team/manager-review-queue/tests/review-guards.test.mjs
```

- Service behavior tests pass:

```bash
node --test tools/v2/team/manager-review-queue/tests/review-engine.test.mjs
```

- The tool still uses deterministic local fixtures only.
- No route, auth, wallet, database, mail rendering, or Stellar integration files
  are modified.

## What To Inspect

| Area | File | Expected behavior |
| --- | --- | --- |
| Queue service | `services/reviewEngine.ts` | Fetches local queue items, filters by status/risk, paginates, updates status, and can reset local state. |
| Fixtures | `fixtures/reviewFixtures.ts` | Provides four deterministic review items across pending, approved, and escalated states. |
| Guard fixtures | `fixtures/sample-review-requests.json` | Covers valid requests, hostile payloads, and sanitization edge cases. |
| Guard tests | `tests/review-guards.test.mjs` | Validates field allowlists, hostile input rejection, sanitization, and size guards. |
| Service tests | `tests/review-engine.test.mjs` | Validates fetch filtering, pagination, status updates, not-found errors, and reset behavior. |

## Known Limitations

- The service is intentionally in-memory and fixture-backed.
- `reviewerNotes` is accepted by the type but not persisted yet.
- The simulated latency value documents future loading states but the Node tests
  mirror the pure logic without waiting on timers.
- Production integration should be handled by a future issue with explicit app
  wiring approval.
