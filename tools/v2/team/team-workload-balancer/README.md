# Team Workload Balancer

This folder is the isolated workspace for the Team Workload Balancer tool.

## Ownership Boundary

All work for this tool must stay inside:

`text
.\tools\v2\team\team-workload-balancer\
`

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

See specs.md for the issue categories and contributor expectations.

## Non-UI execution contract

The workload balancer exposes a presentation-free execution contract so it can
run as a backend service, independent of any UI.

- `contract.ts` — the typed `WorkloadOperation` / `WorkloadContractOutput`, the
  `WorkloadResult<T>` discriminated union, explicit `WorkloadErrorCode` values,
  and `validateBalanceInput`. Wraps the existing synchronous `balanceWorkload`
  in `services/workload-service`.
- `index.ts` — `createWorkloadContract()` returns a `WorkloadContract` whose
  `execute(...)` returns typed success/error results instead of throwing.
- `contract.fixtures.ts` — deterministic sample members/items.
- `tests/contract.test.ts` — vitest coverage of delegation to `balanceWorkload`,
  deterministic strategies (round-robin / least-loaded), and invalid-input error
  paths.

Usage:

```ts
import { createWorkloadContract } from ".";

const contract = createWorkloadContract();
const res = contract.execute({
  operation: "balance",
  unassignedItems,
  members,
  allItems,
  config: { strategy: "least-loaded" },
});
if (res.ok && res.value.operation === "balance") {
  // res.value.result.assignments / res.value.result.metrics
} else {
  // res.error is a WorkloadErrorCode
}
```
