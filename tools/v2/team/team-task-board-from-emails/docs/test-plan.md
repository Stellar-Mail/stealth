# Test Plan

## Automated Fixture Test

Run from the repository root:

```bash
node --test tools/v2/team/team-task-board-from-emails/tests/task-board-fixtures.test.mjs
```

Expected result:

- the sample fixture parses as JSON
- every source email has a matching expected board card
- all four board statuses are represented
- blocked cards require human review
- due dates, priorities, and source links follow the local card contract

## Manual Review Checklist

1. Open `fixtures/sample-task-emails.json`.
2. Confirm every task can be traced back to a source email by `sourceEmailId`.
3. Confirm the fixture includes a realistic mix of assignment, due date,
   priority, and blocked-context examples.
4. Confirm `docs/review-notes.md` lists what is intentionally out of scope.
5. Confirm no files outside `tools/v2/team/team-task-board-from-emails/` changed.

## Edge Cases Covered

- unassigned task routed to `new`
- task needing owner confirmation routed to `triage`
- vendor dependency routed to `blocked`
- completed follow-up routed to `done`
- null due date allowed only when review is required

## Future Integration Tests

When a later issue adds implementation code, add tests for:

- extraction from actual inbox message objects
- duplicate task detection across the same thread
- keyboard-accessible board interactions
- offline-safe draft state
- permission checks for shared team mailboxes
