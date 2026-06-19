# Team Analytics Dashboard

Team Analytics Dashboard is a self-contained V2 team tool contract. It defines
the isolated data model, review notes, and local test fixture used to describe
the dashboard before any product integration exists.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v2/team/team-analytics-dashboard/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet
core, Stellar core, database schema, or shared design system unless a future
integration issue explicitly allows it.

## Folder Layout

```text
team-analytics-dashboard/
|-- components/        # future UI module boundaries
|-- docs/              # local architecture, review, and test notes
|-- fixtures/          # synthetic analytics snapshots
|-- hooks/             # future state and query helpers
|-- services/          # future data shaping and aggregation logic
|-- tests/             # zero-dependency contract tests
|-- specs.md
`-- README.md
```

## Current Contract

The current fixture contract is defined by `fixtures/sample-analytics-data.json`
and validated by the Node test suite.

| Field | Type | Notes |
| --- | --- | --- |
| `tool` | string | Must equal `team-analytics-dashboard` |
| `version` | integer | Positive local contract version |
| `period.start` / `period.end` | ISO date string | `YYYY-MM-DD` and in order |
| `period.label` | string | Human-readable reporting label |
| `teamId` | string | Stable team identifier local to the fixture |
| `members[].memberId` | string | Stable, unique member identifier |
| `members[].status` | enum | `active`, `overloaded`, `underutilized`, or `away` |
| `members[].avgResponseTimeHours` | number or null | Null only when status is `away` |
| `members[].slaBreaches` | integer | Count of items exceeding the 4 hour SLA |
| `summary.reviewRequiredMemberIds` | string[] | Includes every member with SLA breaches |
| `summary.topPerformerId` | string | Active member with zero breaches and best response time |
| `summary.bottleneckMemberId` | string | Member with the highest open thread count |

## Local Test

Run from the repository root:

```bash
node --test tools/v2/team/team-analytics-dashboard/tests/analytics-dashboard-fixtures.test.mjs
```

The suite checks the fixture, status coverage, threshold rules, and summary
consistency.

## Fixture Scenarios

The fixture includes one member for each workload archetype:

| Member | Status | Scenario |
| --- | --- | --- |
| Aisha Mensah | active | Healthy contributor with low response time and no breaches |
| Ben Torres | overloaded | High open-thread count and SLA breaches, so review is required |
| Clara Osei | underutilized | All threads resolved and capacity available |
| David Yun | away | No activity this period and no response-time value |

## Known Limits

- No live data aggregation yet; the fixture is a static snapshot.
- The 4 hour SLA and overload thresholds are encoded in the local test file.
- `avgResponseTimeHours` is a simple arithmetic mean for now.
- Away members intentionally render with `avgResponseTimeHours: null`.

## Review Pointers

See `docs/ARCHITECTURE.md` for the folder-local module boundary, `docs/test-plan.md`
for verification steps, and `docs/review-notes.md` for what future contributors
may and may not change.
