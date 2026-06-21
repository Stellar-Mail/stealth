# Team Workload Balancer — Test Plan

## Run tests

```bash
node --test tools/v2/team/team-workload-balancer/tests/workload-balancer.test.mjs
```

## Test coverage

| Area                         | What is tested                                                                                                                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fixtures**                 | Team members exist with valid properties; workload items have valid fields; unassigned item count                                                                                   |
| **calculateWorkloadMetrics** | Per-member assigned item counts, total capacity, utilization percentages, imbalance score, empty edge cases                                                                         |
| **balanceWorkload**          | All unassigned items get assigned; every assignment references a valid member; reasons are non-empty; metrics included in result; round-robin strategy works; empty unassigned list |
| **suggestAssignment**        | Least-loaded member is selected; item metadata is preserved                                                                                                                         |
| **Member workloads**         | Pending/in-progress/overdue breakdowns; estimated effort sums                                                                                                                       |

## Edge cases covered

- Empty team members array
- Empty workload items array
- No unassigned items
- Utilization at capacity (100%)

## Manual smoke test

To verify the service works end-to-end from Node.js:

```js
// Run with: node --input-type=module
import {
  createWorkloadService,
  calculateWorkloadMetrics,
} from "./tools/v2/team/team-workload-balancer/services/workload-service.ts";
// Note: requires tsx or ts-node for TS imports
```

For testing without a TS loader, the test file uses plain `.mjs` with direct JSON imports and reimplemented functions.
