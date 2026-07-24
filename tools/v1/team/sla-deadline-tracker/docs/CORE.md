# SLA Deadline Tracker — Core Engine

This folder contains the folder-local **core feature engine** for the SLA
Deadline Tracker (issue #450). It is intentionally isolated from the main
application; no integration into routing, the inbox, the wallet core, or the
design system is performed here.

## What is implemented

- `types/index.ts` — `SlaTrackedItem`, `SlaPolicy`, `SlaEvaluation`,
  `SlaSummary`, `SlaStatus`.
- `services/slaTracker.ts` — pure, deterministic engine:
  - `evaluateSla(item, policy, now)` — classify a single item as
    `responded | on-track | due-soon | breached` against a policy at a given
    time. Time is injected so evaluations are reproducible.
  - `summarizeSla(items, policy, now)` — single-pass aggregate counts across a
    collection (safe for large arrays; no hidden sorting).
  - `computeDeadline(startedAt, policy)` — preview a deadline consistently with
    the engine.
- `fixtures/sla.fixture.ts` — deterministic sample items + a standard policy.
- `tests/slaTracker.test.ts` — unit coverage (each status branch, determinism,
  large-array pass, deadline math).
- `index.ts` — the public API surface for future UI/integration work.

## Design notes

- **No live network, secrets, or production data.** All inputs are local; time
  is supplied by the caller (`now`) rather than `Date.now()` inside the engine,
  which keeps evaluations deterministic and testable.
- **Performance:** `summarizeSla` is O(n) and allocates a single summary object;
  it does not sort or copy the item list, so it scales to thousands of tracked
  items without unnecessary work.
- **Error states:** malformed timestamps fall back to a clamped `0` (via
  `finiteOrZero`) rather than producing `NaN`/`-Infinity`, so a single bad
  record cannot corrupt an aggregate view.

## Acceptance criteria

- [x] Core logic implemented without linking into the main app.
- [x] Inputs, outputs, loading/error states documented.
- [x] No live network calls, secrets, or production data introduced.
- [x] Files changed limited to `tools/v1/team/sla-deadline-tracker/`.
- [x] Reviewable as a self-contained mini-product change.
