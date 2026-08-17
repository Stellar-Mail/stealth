# Team Analytics Dashboard

A self-contained V2 team tool that surfaces per-member performance metrics — email volume, response times, SLA breaches, and workload balance — across a configurable time period, complete with an accessible, keyboard-navigable UI surface.

## Ownership Boundary

All work for this tool must stay inside:

```
tools/v2/team/team-analytics-dashboard/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet
core, Stellar core, database schema, or shared design system unless a future
integration issue explicitly allows it.

## Folder Structure

```
team-analytics-dashboard/
├── components/
│   ├── EmptyState.tsx                   # accessible empty state with CTA
│   ├── LoadingState.tsx                 # polite live region loading spinner
│   ├── ErrorState.tsx                   # assertive alert state with retry action
│   ├── SuccessState.tsx                 # polite success banner with dismiss
│   ├── SummaryCards.tsx                 # team metrics summary & SLA breach alerts
│   ├── MemberTable.tsx                  # sortable member data table with ARIA sort
│   ├── SnapshotList.tsx                 # keyboard-navigable snapshot card grid
│   ├── TeamAnalyticsDashboard.tsx       # main UI workflow (tabs, filters, search)
│   └── index.ts                         # components export bundle
├── hooks/
│   ├── use-team-analytics.ts            # state management, sorting, filtering, refresh
│   └── index.ts                         # hooks export bundle
├── services/
│   ├── analytics-dashboard.service.mjs  # core dashboard report generator
│   ├── analytics-snapshot.service.mjs   # team snapshot classifier
│   └── index.ts                         # typed ESM service re-exports
├── contract/
│   └── analytics-contract.d.ts          # TypeScript data schema and contract definitions
├── fixtures/
│   ├── sample-analytics-data.json       # local contract fixture (4 members, 1 week)
│   ├── sample-team-analytics.json       # snapshot review fixture (4 teams)
│   └── index.ts                         # typed fixture and sample report exports
├── tests/
│   ├── components.test.tsx              # Vitest UI component test suite (20 tests)
│   ├── hooks.test.tsx                   # Vitest custom hook test suite (7 tests)
│   ├── analytics-dashboard-fixtures.test.mjs   # fixture + service test suite
│   ├── analytics-fixtures.test.mjs             # snapshot fixture + service test suite
│   ├── analytics-contract.test.mjs             # contract schema test suite
│   └── analytics-guards.test.mjs               # validation guards test suite
├── docs/
│   ├── ACCESSIBILITY.md  # WCAG 2.1 AA keyboard navigation, ARIA live regions, semantics
│   ├── VISUAL_STYLE.md   # Tailwind CSS semantic token compliance & style documentation
│   ├── test-plan.md      # how to run and manually validate the tests
│   └── review-notes.md   # scope, reviewer focus, and follow-up work
├── demo.tsx              # interactive demo component with state simulation buttons
├── index.ts              # main tool entry point exporting components, hooks, services, demo
├── vitest.config.ts      # Vitest configuration for UI component & hook test suites
├── specs.md              # tool specifications and release scope
└── README.md
```

## Data Contract

The fixture (`fixtures/sample-analytics-data.json`) defines the shape the dashboard consumes:

| Field                             | Type            | Notes                                                         |
| --------------------------------- | --------------- | ------------------------------------------------------------- |
| `tool`                            | string          | must equal `"team-analytics-dashboard"`                       |
| `period.start` / `period.end`     | ISO date string | `YYYY-MM-DD`                                                  |
| `members[].memberId`              | string          | stable, unique                                                |
| `members[].status`                | enum            | `active` / `overloaded` / `underutilized` / `away`            |
| `members[].avgResponseTimeHours`  | number \| null  | null when status is `away`                                    |
| `members[].slaBreaches`           | integer         | count of threads that exceeded the 4-hour SLA                 |
| `summary.reviewRequiredMemberIds` | string[]        | populated for any member with slaBreaches > 0                 |
| `summary.topPerformerId`          | string          | active member with lowest response time and zero SLA breaches |
| `summary.bottleneckMemberId`      | string          | member with the highest open-thread count                     |

## Running the Tests

### 1. UI Component & Hook Unit Tests (Vitest)

Run from the repository root:

```bash
npx vitest run --root tools/v2/team/team-analytics-dashboard
```

Expected output: 27 passing tests (20 component tests + 7 hook tests) across 2 suites.

### 2. Service & Fixture Contract Tests (Node --test)

Run from the repository root:

```bash
node --test tools/v2/team/team-analytics-dashboard/tests/analytics-dashboard-fixtures.test.mjs tools/v2/team/team-analytics-dashboard/tests/analytics-fixtures.test.mjs tools/v2/team/team-analytics-dashboard/tests/analytics-contract.test.mjs tools/v2/team/team-analytics-dashboard/tests/analytics-guards.test.mjs
```

Expected output: 27 passing tests across all 4 suites.

## Core Services

### `services/analytics-dashboard.service.mjs`

The dashboard report generator (`generateDashboardReport`) transforms raw member data into a structured analytics report:

- **`classifyMemberStatus(member)`** — determines workload status (`active`, `overloaded`, `underutilized`, or `away`) based on open threads, SLA breaches, and resolved volume.
- **`findTopPerformer(members)`** — identifies the active member with the lowest response time and zero SLA breaches.
- **`findBottleneck(members)`** — identifies the member with the highest open-thread count.
- **`generateDashboardReport(data)`** — orchestrates the full transform and returns a complete report with member snapshots and team summary.

### `services/analytics-snapshot.service.mjs`

The snapshot service (`generateSnapshots`) classifies team source reports into dashboard-ready snapshots:

- **`computeSnapshotStatus(report)`** — maps a source report to one of `healthy`, `watch`, `needs-attention`, or `blocked` based on backlog size, response time, and data completeness.
- **`generateSnapshots(sourceReports)`** — transforms an array of source reports into an array of analytics snapshots with computed status and review flags.

## UI Surface & Accessibility

- **Accessible Tab Switching**: Users can toggle between the `Member Workload` and `Team Snapshots` views using mouse clicks or keyboard arrow keys (`role="tablist"`, `role="tab"`).
- **Sortable Performance Table**: Supports sorting by column (`Member`, `Status`, `Received`, `Handled`, `Open`, `Resolved`, `SLA Breaches`, `Avg Response Time`) with dynamic `aria-sort` indicators.
- **Status Badges & Warning Alerts**: All badges combine symbolic icons (`✓`, `⚠️`, `ℹ️`, `⏸️`, `👀`, `🛑`) with text so state is never conveyed by color alone.
- **Null / Away Handling**: Away members or blocked snapshots with null response time display `"N/A"` with explicit `aria-label="Not applicable"` so assistive technologies never announce ambiguous zeros.
- **Demo Mode**: The interactive `TeamAnalyticsDashboardDemo` component in `demo.tsx` lets reviewers simulate normal, loading, error, and empty states at the click of a button.

## Fixture Scenarios

The fixture includes one member for each workload archetype:

| Member       | Status        | Scenario                                                          |
| ------------ | ------------- | ----------------------------------------------------------------- |
| Aisha Mensah | active        | Healthy contributor — low response time, no SLA breaches          |
| Ben Torres   | overloaded    | High open-thread count and SLA breaches — surfaces in review list |
| Clara Osei   | underutilized | All threads resolved — has available capacity                     |
| David Yun    | away          | No activity this period — null response time                      |

## Known Limitations

- No live data aggregation yet; the fixture is a static snapshot.
- SLA threshold (4 hours) and overload thresholds are constants in the test file — update them if the product definition changes.
- `avgResponseTimeHours` is the raw arithmetic mean; future implementation may weight by thread complexity.
- Away members have null response time; UI rendering N/A instead of 0 is a required behaviour enforced by the test.

## Review

See `docs/test-plan.md` for the full manual review checklist, `docs/ACCESSIBILITY.md` for WCAG 2.1 AA keyboard/ARIA details, `docs/VISUAL_STYLE.md` for Tailwind styling compliance, and `docs/review-notes.md` for contributor scope and follow-up issues.
