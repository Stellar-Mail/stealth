# Team Payment Approval Specs

## Purpose

Define a self-contained review contract for team payment approvals before any
future app, wallet, or finance-system integration.

## Release Scope

- Release tier: V2 later-release tool
- Audience: team
- Folder ownership: `tools/v2/team/team-payment-approval/`
- Integration status: isolated mini-product workspace

## In-Scope Behavior

- Model payment requests with audit-friendly source metadata.
- Distinguish low-risk approvals from requests that need finance review.
- Represent blocked requests without attempting payment side effects.
- Provide fixture coverage for each local approval status.
- Give reviewers a single local test command.

## Out-of-Scope Behavior

- Main app routing or dashboard registration
- Inbox ingestion, mail rendering, or attachment storage changes
- Wallet, Stellar, bank transfer, tax, or invoice execution
- Database schema or shared design system changes
- Notification delivery or role-permission enforcement

## Approval Request Contract

Each expected approval record should include:

- `id`: stable fixture-local request identifier
- `vendor`: payee or vendor display name
- `amount`: positive numeric payment amount
- `currency`: ISO-style currency code
- `requester`: team member requesting payment
- `status`: one of `submitted`, `needs-review`, `blocked`, `approved`
- `requiredApprovers`: list of roles or people required before execution
- `sourceRecordId`: source email or internal request identifier
- `reviewRequired`: true when a person must resolve missing or risky details

## Review Rules

- amounts at or above 5000 require finance review
- missing supporting documents must be blocked
- approved requests must include at least one required approver
- blocked and needs-review requests must set `reviewRequired` to true

## Required Issue Categories

- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation

## Contributor Boundary

Keep all changes for this issue in this folder. If a future issue adds actual
payment execution, it should define security, audit, and wallet constraints
before connecting this tool to live data.
