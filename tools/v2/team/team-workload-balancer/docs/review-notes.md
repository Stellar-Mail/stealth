# Team Workload Balancer — Review Notes

## Core logic

- `services/workload-service.ts` contains all balancing algorithms and metrics calculations.
- Three strategies are implemented: `least-loaded`, `round-robin`, and `capacity-weighted`.
- `calculateWorkloadMetrics` computes per-member utilization, aggregate stats, and an imbalance score (standard deviation of utilization).
- `balanceWorkload` distributes unassigned items across team members using the selected strategy.
- `suggestAssignment` returns a single assignment suggestion with a human-readable reason.

## Fixtures

- `fixtures/team-members.json` — 4 team members with varying capacities, roles, and skills.
- `fixtures/workload-items.json` — 12 items (some assigned, some unassigned) across priorities and statuses.

## States documented

- **Loading**: All async service methods support a `simulateDelay` config (default `true`, ~600ms).
- **Empty**: `getWorkloadItems` returns an empty array when no items match. The `FetchState` type includes an `"empty"` status.
- **Error**: `failureRate` config (default `0`) allows testing error paths. Service methods throw when failure triggers. `FetchState` includes `"error"` with a message.
- **Success**: Normal data flow returns `{ status: "success", data }`.

## Hook

- `hooks/use-workload-balancer.ts` — React hook wrapping the service with `useReducer` for state management.
- Exposes `load`, `retry`, and `runBalancer(config)` functions.
- All loading states are tracked independently per slice (members, items, metrics, balance result).

## No live network calls / secrets / production data

- All data comes from local JSON fixture files.
- No API keys, secrets, or production credentials are introduced.
- No HTTP calls are made — the service uses simulated async delays.

## Files changed are limited to $rel/

All work is contained within `tools/v2/team/team-workload-balancer/`.

## Issue linkage note

The original delivery PR (#767) merged the folder-local tests, fixtures, and docs, but
its description referenced the issue without a GitHub closing keyword, so the issue was
not auto-closed or linked on merge. This follow-up records the completed linkage so that
issue #713 is closed by a merged pull request.
