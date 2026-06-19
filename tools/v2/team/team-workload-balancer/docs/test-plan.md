# Team Workload Balancer Test Plan

## Automated Test

Run from the repository root:

```bash
node --test tools/v2/team/team-workload-balancer/tests/workload-balancer.test.mjs
```

Expected result:

- the fixture loads successfully
- the balancing service returns assignments for every work item
- tasks with matching skills are assigned to the lowest-loaded eligible member
- tasks with no matching skills remain `unassigned`
- the result order reflects the local priority contract

## Manual Review Checklist

1. Open `fixtures/sample-workload-requests.json`.
2. Confirm team members include a realistic mix of skills, current load, and capacity.
3. Confirm work items include high priority, same-skill, and no-skill-match cases.
4. Confirm `docs/review-notes.md` describes the review scope and limitations.
5. Confirm no files outside `tools/v2/team/team-workload-balancer/` changed.

## Edge Cases Covered

- higher-priority tasks are assigned before lower-priority tasks
- load balancing chooses the member with the lowest current load
- skill-required tasks are routed only to capable members
- missing skill coverage leaves work unassigned instead of silently guessing

## Future Integration Tests

When a later issue adds implementation code, add tests for:

- ingestion from actual team workload requests or shared mailbox metadata
- capacity updates, team skill changes, and real-time balancing
- UI rendering of assignment status and member load
- permission-aware review flows for team workload boards
- end-to-end app wiring only after a future integration issue allows it
