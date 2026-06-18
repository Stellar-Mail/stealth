# Test Plan

## Automated Fixture Test

Run from the repository root:

```bash
node --test tools/v2/team/team-analytics-dashboard/tests/analytics-dashboard-fixtures.test.mjs
```

Expected result:

- the fixture parses as valid JSON
- `tool` equals `"team-analytics-dashboard"` and `version` is a positive integer
- `period.start` and `period.end` are ISO dates and are in order
- every member has required fields within valid ranges
- all four member statuses (`active`, `overloaded`, `underutilized`, `away`) appear in the fixture
- `overloaded` status only appears when open-thread count or SLA breach count exceeds the defined threshold
- `summary` totals (volume, handled, open, SLA breaches) match the sum of individual member values
- `topPerformerId` and `bottleneckMemberId` resolve to real member IDs
- every member with SLA breaches appears in `summary.reviewRequiredMemberIds`
- the top performer is `active` with zero SLA breaches
- the bottleneck member holds the highest `openThreads` count

## Manual Review Checklist

1. Open `fixtures/sample-analytics-data.json`.
2. Confirm the period covers a realistic week range and `label` is human-readable.
3. Confirm each member represents a distinct workload scenario:
   - `member-001` — healthy active contributor (low response time, no breaches)
   - `member-002` — overloaded member with SLA breaches (surfaces in review list)
   - `member-003` — underutilized (all threads resolved, capacity available)
   - `member-004` — away (null response time, zero activity)
4. Confirm `summary` fields match the per-member sums without manual arithmetic.
5. Confirm `docs/review-notes.md` lists what is intentionally out of scope.
6. Confirm no files outside `tools/v2/team/team-analytics-dashboard/` changed.

## Edge Cases Covered

- away member with null `avgResponseTimeHours` (UI must render N/A, not 0)
- `emailsHandled` cannot exceed `emailsReceived`
- `openThreads` = 0 for both underutilized and away members
- `reviewRequiredMemberIds` is populated solely by SLA breach count, not by status
- `topPerformer` excludes away, overloaded, and underutilized members
- `bottleneck` resolves to the highest raw open-thread count regardless of status

## Future Integration Tests

When a later issue adds implementation code, add tests for:

- aggregating live inbox data into the analytics contract
- time-range filtering (daily, weekly, monthly views)
- keyboard-accessible data table and chart interactions
- permission checks (only team managers see individual breakdowns)
- real-time refresh and stale-data indicators
- export to CSV / shareable link
