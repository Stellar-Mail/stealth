# Test Plan

## Automated Fixture Test

Run from the repository root:

```bash
node --test tools/v2/team/team-payment-approval/tests/payment-approval-fixtures.test.mjs
```

Expected result:

- the sample fixture parses as JSON
- each source record maps to one expected approval
- all local approval statuses are represented
- payment amounts are positive numbers
- high-value payments require finance review
- blocked requests require human review

## Manual Review Checklist

1. Open `fixtures/sample-payment-approvals.json`.
2. Confirm all source records use synthetic data.
3. Confirm each expected approval has a traceable `sourceRecordId`.
4. Confirm `docs/review-notes.md` documents out-of-scope payment execution.
5. Confirm no files outside `tools/v2/team/team-payment-approval/` changed.

## Edge Cases Covered

- standard request ready for approval
- high-value request routed to finance review
- missing documentation routed to blocked
- completed approval with complete evidence

## Future Integration Tests

When implementation code is added, add tests for:

- duplicate request detection
- invoice attachment presence checks
- role-based approval permissions
- audit log creation
- offline-safe reviewer decisions
