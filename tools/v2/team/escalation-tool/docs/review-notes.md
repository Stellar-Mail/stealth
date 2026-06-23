# Escalation Tool Review Notes

## Scope

This issue adds test and documentation scaffolding for the isolated Escalation
Tool workspace. The folder does not yet include a routing engine, hooks, or UI
components.

## How To Review

1. Run `node tools/v2/team/escalation-tool/tests/documentation-contract.test.mjs`.
2. Inspect `fixtures/sample-escalations.json` for state coverage and synthetic
   data.
3. Confirm README and specs describe the local boundary.
4. Confirm future implementation notes do not require main app changes.

## Fixture Intent

The sample fixture includes:

- `queued`: conversation waiting for assignment
- `assigned`: conversation already routed to a team member
- `escalated`: critical SLA-risk conversation
- `resolved`: completed conversation that should remain closed
- `blocked`: missing routing owner that needs human review

## Known Limitations

- No routing logic is implemented in this issue.
- No UI surface is mounted.
- No real mail, customer, or team directory data is included.
- Future work should add a pure service layer before any app integration.

## Safety Notes

- No secrets, payment data, or production content is included.
- No live network calls are required.
- Fixture email addresses use `.test` domains.
