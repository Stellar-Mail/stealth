# Test Plan

## Automated Component & Hook Tests (Vitest)

Run from the repository root:

```bash
npx vitest run --root tools/v2/team/team-analytics-dashboard
```

Expected result — 27 passing tests across 2 test suites:

### 1. Component Tests (`tests/components.test.tsx` - 20 tests)

- `EmptyState`: Renders title, description, and interactive action button.
- `LoadingState`: Renders `role="status"` with `aria-busy="true"` and spinner message.
- `ErrorState`: Renders `role="alert"` with immediate assertive announcement and retry action.
- `SuccessState`: Renders success banner with dismiss button.
- `SummaryCards`:
  - Renders team volume, backlog, average response time, and SLA breach totals.
  - Displays `"N/A"` with `aria-label="Not applicable"` when average response time is null.
  - Triggers review-required table filter when the alert banner button is clicked.
- `MemberTable`:
  - Renders member rows, status badges (combining icon + text), and SLA breach indicators.
  - Renders `"N/A"` for away members or null response times (not `0`).
  - Invokes column sorting via mouse click and keyboard activation on column headers.
  - Invokes row selection via click, Enter, and Space key down events.
- `SnapshotList`:
  - Renders cards with `healthy`, `watch`, `needs-attention`, and `blocked` statuses.
  - Displays `"N/A"` for blocked snapshots with null `averageFirstResponseHours`.
  - Supports card selection via click and keyboard activation.
- `TeamAnalyticsDashboard`:
  - Renders dashboard header, reporting period label, and tab navigation.
  - Switches between `Member Workload` and `Team Snapshots` panels.
  - Filters table rows by status pills (`Active`, `Overloaded`, `Underutilized`, `Away`) and search query.
  - Renders `LoadingState`, `ErrorState`, `EmptyState`, or `SuccessState` according to props.

### 2. Hook Tests (`tests/hooks.test.tsx` - 7 tests)

- `useTeamAnalytics`:
  - Initializes with default sample report and snapshots.
  - Filters members by status and `reviewRequiredOnly`.
  - Filters members by search query matching `memberId` or `name` (case-insensitive).
  - Toggles sort order (`asc` / `desc`) when sorting by columns.
  - Clears all active filters when `handleClearFilters` is called.
  - Supports custom refresh and retry callbacks.

## Automated Fixture & Service Tests (Node --test)

Run from the repository root:

```bash
node --test tools/v2/team/team-analytics-dashboard/tests/analytics-dashboard-fixtures.test.mjs tools/v2/team/team-analytics-dashboard/tests/analytics-fixtures.test.mjs tools/v2/team/team-analytics-dashboard/tests/analytics-contract.test.mjs tools/v2/team/team-analytics-dashboard/tests/analytics-guards.test.mjs
```

Expected result — 27 passing tests:

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
- `generateDashboardReport()` produces output matching the fixture's expected summary and member statuses
- the snapshot fixture follows the local review contract (source report → snapshot mapping)
- `generateSnapshots()` produces output matching the fixture's expected snapshot values
- validation guards correctly throw documented error codes on invalid or malformed data

## Manual Review Checklist

1. Open `demo.tsx` and verify `TeamAnalyticsDashboardDemo` mounts cleanly without runtime errors.
2. Verify interactive Demo State Controls:
   - Click **Simulate Loading** -> verify `aria-busy="true"` and spinner announce.
   - Click **Simulate Error** -> verify `role="alert"` assertive error banner with Try Again button.
   - Click **Simulate Empty** -> verify empty state illustration and Load Sample Data CTA.
   - Click **Normal State** -> verify table, summary cards, and tabs render.
3. Verify Keyboard Navigation (`ACCESSIBILITY.md`):
   - Tab through view tabs and use Left/Right arrows to switch between `Member Workload` and `Team Snapshots`.
   - Press Enter/Space on column sort headers to toggle ascending/descending order.
4. Confirm `docs/review-notes.md` lists what is intentionally out of scope.
5. Confirm no files outside `tools/v2/team/team-analytics-dashboard/` changed.

## Edge Cases Covered

- away member with null `avgResponseTimeHours` (UI renders `"N/A"`, not `0`, with explicit `aria-label="Not applicable"`)
- blocked snapshot with null `averageFirstResponseHours` (UI renders `"N/A"`)
- `emailsHandled` cannot exceed `emailsReceived`
- `openThreads` = 0 for both underutilized and away members
- `reviewRequiredMemberIds` is populated solely by SLA breach count, not by status
- `topPerformer` excludes away, overloaded, and underutilized members
- `bottleneck` resolves to the highest raw open-thread count regardless of status
- Status badges combine icon and text so meaning is never conveyed by color alone

## Future Integration Tests

When a later issue connects this tool to the main app, add tests for:

- aggregating live inbox data into the analytics contract
- time-range filtering (daily, weekly, monthly views)
- permission checks (only team managers see individual breakdowns)
- real-time refresh and stale-data indicators
- export to CSV / shareable link
