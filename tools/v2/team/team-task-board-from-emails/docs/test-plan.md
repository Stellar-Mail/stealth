# Test Plan

## Automated Fixture Test

Run from the repository root:

```bash
node --test tools/v2/team/team-task-board-from-emails/tests/task-board-fixtures.test.mjs
```

Expected result:

- The sample fixture parses as JSON.
- Every source email has a matching expected board card.
- All four board statuses are represented.
- Blocked cards require human review.
- Due dates, priorities, and source links follow the local card contract.
- The `extractTaskFromEmail` helper correctly processes all fixture emails and matches the `expectedCards` exactly.
- The `groupTasksByStatus` helper correctly partitions tasks into `new`, `triage`, `blocked`, and `done` columns.

## Manual Review Checklist

1. Open [sample-task-emails.json](file:///home/mxr/stealth/tools/v2/team/team-task-board-from-emails/fixtures/sample-task-emails.json).
2. Confirm every task can be traced back to a source email by `sourceEmailId`.
3. Confirm the fixture includes a realistic mix of assignment, due date, priority, and blocked-context examples.
4. Confirm [review-notes.md](file:///home/mxr/stealth/tools/v2/team/team-task-board-from-emails/docs/review-notes.md) lists what is intentionally out of scope.
5. Confirm no files outside `tools/v2/team/team-task-board-from-emails/` were changed.

## Edge Cases Covered

- Unassigned task routed to `new`
- Task needing owner confirmation routed to `triage`
- Vendor dependency routed to `blocked`
- Completed follow-up routed to `done`
- Null due date allowed only when review is required

## Future Integration Tests

When a later issue adds integration and UI code, add tests for:

- Extraction from actual inbox message objects.
- Duplicate task detection across the same thread.
- Keyboard-accessible board interactions.
- Offline-safe draft state.
- Permission checks for shared team mailboxes.
