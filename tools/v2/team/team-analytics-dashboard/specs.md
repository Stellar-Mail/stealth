# Team Analytics Dashboard Specs

## Purpose

Define a self-contained review contract for team email performance analytics, including UI and accessibility surface components, before any future dashboard, inbox, or notification integration.

## Release Scope

- Release tier: V2 later-release tool
- Audience: team
- Folder ownership: `tools/v2/team/team-analytics-dashboard/`
- Integration status: isolated mini-product workspace

## In-Scope Behavior

- Model team metric snapshots and member performance reports with synthetic source metadata.
- Provide accessible local UI components (`TeamAnalyticsDashboard`, `SummaryCards`, `MemberTable`, `SnapshotList`) with keyboard navigation and screen-reader support.
- Render explicit empty, loading, error, and success states (`EmptyState`, `LoadingState`, `ErrorState`, `SuccessState`).
- Distinguish healthy teams from watch, attention, and blocked states using combined iconography and text.
- Represent missing source data and away members without attempting live aggregation (rendering `"N/A"` instead of zero values).
- Provide fixture coverage and interactive demo setup (`demo.tsx`) for each local analytics status.
- Give reviewers automated test commands for both service logic (Node `--test`) and UI components/hooks (Vitest).

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
