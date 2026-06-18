# Team Analytics Dashboard Specs

## Purpose

Define a self-contained review contract for team email performance analytics
before any future dashboard, inbox, or notification integration.

## Release Scope

- Release tier: V2 later-release tool
- Audience: team
- Folder ownership: `tools/v2/team/team-analytics-dashboard/`
- Integration status: isolated mini-product workspace

## In-Scope Behavior

- Model team metric snapshots with synthetic source metadata.
- Distinguish healthy teams from watch, attention, and blocked states.
- Represent missing source data without attempting live aggregation.
- Provide fixture coverage for each local analytics status.
- Give reviewers a single local test command.

## Out-of-Scope Behavior

- Main app routing or dashboard registration
- Inbox ingestion, mail rendering, or metric collection changes
- Database schema, chart rendering, or shared design system changes
- Notification delivery or role-permission enforcement
- Real user productivity scoring

## Analytics Snapshot Contract

Each expected analytics snapshot should include:

- `id`: stable fixture-local snapshot identifier
- `team`: team display name
- `period`: reporting period label
- `status`: one of `healthy`, `watch`, `needs-attention`, `blocked`
- `totalThreads`: non-negative number of tracked threads
- `averageFirstResponseHours`: non-negative number or null when blocked
- `openBacklog`: non-negative number of unresolved threads
- `sourceReportId`: source report identifier
- `reviewRequired`: true when a person must investigate the snapshot

## Review Rules

- blocked snapshots must have missing or invalid source data
- blocked and needs-attention snapshots must require review
- high backlog snapshots should not be healthy
- healthy snapshots need positive source data and no review requirement
- every snapshot must map back to a source report

## Required Issue Categories

- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation

## Contributor Boundary

Keep all changes for this issue in this folder. If a future issue adds live
analytics, it should define privacy, retention, aggregation, and role-access
constraints before connecting this tool to production data.
