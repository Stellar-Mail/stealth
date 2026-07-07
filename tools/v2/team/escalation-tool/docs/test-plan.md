# Escalation Tool Test Plan

## Automated Checks

Run from the repository root:

```bash
node --test tools/v2/team/escalation-tool/tests/escalation-docs.test.mjs
```

The local test checks that:

- synthetic fixture data uses stable ids and contains no production data.
- each expected escalation status is represented at least once.
- high-risk cases require manager review or urgent escalation.
- cases without an owner are classified as `needs-owner`.
- documentation includes setup, fixture, limitation, and review guidance.

## Manual Review Checklist

- Confirm all changed files stay under `tools/v2/team/escalation-tool/`.
- Confirm fixtures are synthetic and do not include real customer, mailbox, or
  team data.
- Confirm the documented statuses match the fixture contract in `specs.md`.
- Confirm the review notes make future integration boundaries explicit.
- Confirm no live network calls, secrets, database writes, notifications, wallet
  behavior, Stellar behavior, or app routing changes are introduced.

## Future Code Coverage

When a core service is added later, extend the local tests to cover:

- deterministic scoring of escalation signals.
- SLA-sensitive age thresholds.
- owner assignment fallback behavior.
- manager-review and urgent-escalation boundaries.
- empty, loading, error, and success states for future UI work.

Keep future tests folder-local unless a separate integration issue explicitly
allows app-wide coverage.
