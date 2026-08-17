# Test Plan

## Automated Fixture Test

Run from the repository root:

```bash
node --test tools/v2/team/vendor-mail-tracker/tests/vendor-mail-fixtures.test.mjs
```

Expected result:

- the sample fixture parses as JSON
- each source message maps to one expected vendor thread
- all local vendor thread statuses are represented
- thread priorities are limited to the local priority set
- blocked threads require human review
- resolved threads do not require a next action due date

## Manual Review Checklist

1. Open `fixtures/sample-vendor-mails.json`.
2. Confirm all source messages use synthetic data.
3. Confirm each expected thread has a traceable `sourceMessageId`.
4. Confirm `docs/review-notes.md` documents out-of-scope live mailbox behavior.
5. Confirm no files outside `tools/v2/team/vendor-mail-tracker/` changed.

## Edge Cases Covered

- active vendor onboarding thread
- high-priority waiting-on-vendor thread
- blocked invoice thread with missing supporting documentation
- resolved procurement thread without future due date

## Future Integration Tests

When implementation code is added, add tests for:

- stale thread threshold configuration
- duplicate vendor thread detection
- attachment and document presence checks
- owner assignment and reassignment
- notification throttling and audit log creation
