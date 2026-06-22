# Test Plan

## Automated Fixture Test

Run from the repository root:

```bash
node --test tools/v2/team/team-digest-generator/tests/digest-fixtures.test.mjs
```

Expected result:

- the sample fixture parses as JSON
- every source activity has a matching expected digest item
- all four digest item types are represented
- items requiring attention have appropriate priority or action signals
- timestamps follow ISO 8601 format
- summary statistics match the expected digest

## Service Integration Test

The same test also imports the digest generator service and validates that
`generateDigest()` produces output matching the expected digest contract:

- digest date and team match the fixture
- item count matches
- summary totals are correct
- each generated item matches the expected id, type, source reference,
  priority, and attention flag

## Manual Review Checklist

1. Open `fixtures/sample-team-activity.json`.
2. Confirm every digest item can be traced back to a source email by
   `sourceEmailId`.
3. Confirm the fixture includes a realistic mix of item types: new messages,
   pending items, completed items, and team summaries.
4. Confirm `docs/review-notes.md` lists what is intentionally out of scope.
5. Confirm no files outside `tools/v2/team/team-digest-generator/` changed.

## Edge Cases Covered

- blocked/failed item classified as pending with high priority
- completed item correctly classified and flagged as not requiring attention
- team_summary item with low priority from planning signals
- security alert classified as new message with high priority
- requiresAttention flag set for high-priority and action-signal items
- summary rolls up distinct team members correctly

## Future Integration Tests

When a later issue adds implementation code, add tests for:

- extraction from actual inbox message objects
- duplicate detection across the same thread
- keyboard-accessible digest navigation
- offline-safe draft state
- permission checks for shared team mailboxes
