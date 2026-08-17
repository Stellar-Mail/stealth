# Test Plan

## Automated Fixture Test

Run from the repository root:

```bash
node --test tools/v2/individual/deadline-detector/tests/deadline-fixtures.test.mjs
```

Expected result:

- the sample fixture parses as JSON
- each source message maps to one expected deadline
- all local statuses are represented
- dates and times use stable ISO-like formats
- detected rows have high confidence and do not require review
- missed rows are marked overdue
- ignored rows do not schedule dates

## Automated Engine Output Test

Run from the repository root:

    node --test tools/v2/individual/deadline-detector/tests/deadline-detection.test.mjs

This test executes the detector against the sample fixture and asserts that:

- detectDeadlines returns one deadline per source message
- every expected deadline is reproduced field by field, covering status, urgency, due date and time, timezone, confidence, and the review flag
- the summary status counts add up to the total
- sortDetectedDeadlines orders by urgency without mutating its input

Where the fixture test confirms the sample data is well formed, this test confirms the engine actually reproduces that data.

## Manual Review Checklist

1. Confirm all changed files are under
   `tools/v2/individual/deadline-detector/`.
2. Confirm all fixture senders use `example.test` and no personal data.
3. Inspect `DeadlineDetectorTool.tsx` for loading, error, empty, and success
   render paths.
4. Confirm reminder and review callbacks are passed in as props and do not
   mutate mailbox, calendar, database, or app routing state.
5. Confirm `docs/ACCESSIBILITY.md` and `docs/VISUAL_STYLE.md` cover the UI
   requirements in the issue.

## Edge Cases Covered

- exact date with time
- relative date with time
- ambiguous timing that requires manual review
- overdue deadline
- newsletter or digest that should be ignored

## Future Integration Tests

When a future issue allows app wiring, add tests for:

- real message adapter input normalization
- locale-aware date parsing
- reminder permission prompts
- duplicate deadline suppression
- calendar write failure recovery
- persisted audit history
