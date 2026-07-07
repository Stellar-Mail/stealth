# Invoice Approval Workflow

Review invoice-like requests and classify them for approval, follow-up, or
rejection before a future integration writes to any payment or accounting
system.

## Scope

- Release tier: V2
- Audience: team
- Folder ownership: `tools/v2/team/invoice-approval-workflow/`

This is a self-contained tooling workspace. Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, or design system unless a future integration issue explicitly allows it.

## Recommended Internal Structure

- components/
- services/
- hooks/
- tests/
- docs/

## Fixture Contract

Synthetic approval cases should include:

- `id`: stable fixture-local identifier.
- `invoiceId`: synthetic invoice identifier.
- `vendor`: synthetic vendor name.
- `amount`: numeric invoice amount.
- `currency`: ISO-like currency code for display.
- `department`: team requesting approval.
- `requestedBy`: synthetic requester name.
- `riskFlags`: local review reasons such as missing purchase order or duplicate
  invoice warning.
- `approvalStatus`: `ready-for-approval`, `needs-review`, `blocked`, or
  `rejected`.
- `reviewRequired`: true unless the invoice is ready for approval.
- `nextAction`: reviewable guidance for the team.
- `containsProductionData`: false for all local fixtures.

## Status Rules

- `ready-for-approval`: invoice has enough clean metadata for a future approval
  queue.
- `needs-review`: invoice needs human verification but is not blocked.
- `blocked`: invoice cannot proceed until required details are supplied.
- `rejected`: invoice should not proceed because it is duplicate, invalid, or
  out of policy.

## Contributor Boundary

All work for this tool should stay in:

```text
tools/v2/team/invoice-approval-workflow/
```

Do not add payment execution, wallet behavior, Stellar behavior, inbox writes,
database persistence, accounting exports, app routes, or shared design system
changes in this issue.

## Required issue categories

- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation
