# Escalation Tool

Escalate team conversations that need urgent action, owner reassignment,
manager review, or a documented follow-up path.

## Scope

- Release tier: V2
- Audience: team
- Folder ownership: `tools/v2/team/escalation-tool/`

This is a self-contained tooling workspace. Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, or design system unless a future integration issue explicitly allows it.

## Recommended Internal Structure

- components/
- services/
- hooks/
- tests/
- docs/

## Review Model

Source escalation cases should describe synthetic team email context:

- `id`: stable fixture-local identifier.
- `threadId`: synthetic email thread identifier.
- `subject`: synthetic team thread subject.
- `owner`: current accountable team member.
- `department`: team or function responsible for the next step.
- `ageHours`: hours since the item last changed.
- `riskLevel`: `low`, `medium`, `high`, or `critical`.
- `signals`: local reasons for escalation consideration.
- `recommendedStatus`: `monitor`, `needs-owner`, `manager-review`, or
  `urgent-escalation`.
- `nextAction`: reviewable action text for the team.
- `containsProductionData`: false for local fixtures.

## Status Rules

- `monitor`: no immediate handoff is required.
- `needs-owner`: ownership is missing, stale, or ambiguous.
- `manager-review`: a decision, approval, or team lead review is required.
- `urgent-escalation`: a high-risk or SLA-sensitive item needs immediate
  follow-up.

## Contributor Boundary

All work for this tool should stay in:

```text
tools/v2/team/escalation-tool/
```

Do not add inbox ingestion, notifications, ticket creation, persistence, routing,
wallet, Stellar, auth, or shared design system changes in this issue.

## Required issue categories

- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation
