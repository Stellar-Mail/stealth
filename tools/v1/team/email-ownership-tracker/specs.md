# Email Ownership Tracker

Track ownership history for team email threads and document when threads are
owned, stale, transferred, or missing an accountable owner.

## Scope

- Release tier: V1
- Audience: team
- Folder ownership: `tools/v1/team/email-ownership-tracker/`

This is a self-contained tooling workspace. Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, or design system unless a future integration issue explicitly allows it.

## Recommended Internal Structure

- components/
- services/
- hooks/
- tests/
- docs/

## Fixture Contract

Synthetic ownership cases should include:

- `id`: stable fixture-local identifier.
- `threadId`: synthetic email thread identifier.
- `subject`: synthetic thread subject.
- `currentOwner`: assigned team member or an empty string when unowned.
- `previousOwner`: previous team member or null.
- `department`: team responsible for the current next step.
- `lastChangedAt`: ISO timestamp for the latest ownership change.
- `ageHours`: hours since the latest ownership update.
- `signals`: local reasons for the ownership status.
- `ownershipStatus`: `owned`, `needs-owner`, `transfer-pending`, or `stale`.
- `reviewRequired`: true unless ownership is healthy.
- `nextAction`: reviewable guidance for the team.
- `containsProductionData`: false for all local fixtures.

## Status Rules

- `owned`: a named owner is attached and the thread is recent.
- `needs-owner`: no owner is assigned.
- `transfer-pending`: ownership is being handed from one teammate to another.
- `stale`: a named owner exists, but ownership has not changed recently enough.

## Contributor Boundary

All work for this tool should stay in:

```text
tools/v1/team/email-ownership-tracker/
```

Do not add inbox writes, mailbox mutations, assignment side effects,
notifications, database persistence, app routes, wallet behavior, Stellar
behavior, auth changes, or shared design system changes in this issue.

## Required issue categories

- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation
