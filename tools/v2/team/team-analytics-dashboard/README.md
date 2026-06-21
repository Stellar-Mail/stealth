# Team Analytics Dashboard

A self-contained V2 team tool that surfaces per-member performance metrics — email volume, response times, SLA breaches, and workload balance — across a configurable time period.

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
├── fixtures/
│   ├── sample-analytics-data.json       # local contract fixture (4 members, 1 week)
│   └── sample-team-analytics.json       # snapshot review fixture (4 teams)
├── services/
│   ├── analytics-dashboard.service.mjs  # core dashboard report generator
│   └── analytics-snapshot.service.mjs   # team snapshot classifier
├── tests/
│   ├── analytics-dashboard-fixtures.test.mjs   # fixture + service test suite
│   └── analytics-fixtures.test.mjs             # snapshot fixture + service test suite
├── docs/
│   ├── test-plan.md      # how to run and manually validate the tests
│   └── review-notes.md   # scope, reviewer focus, and follow-up work
├── specs.md
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

No install step required. Run from the repository root:

```bash
node --test tools/v2/team/team-analytics-dashboard/tests/analytics-dashboard-fixtures.test.mjs
```

Expected output: 10 passing tests, 0 failures.

Also run the snapshot fixture tests:

```bash
node --test tools/v2/team/team-analytics-dashboard/tests/analytics-fixtures.test.mjs
```

Expected output: 2 passing tests, 0 failures.

Or run all dashboard tests together:

```bash
node --test tools/v2/team/team-analytics-dashboard/tests/
```

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

See `docs/test-plan.md` for the full manual review checklist and `docs/review-notes.md` for contributor scope and follow-up issues.
