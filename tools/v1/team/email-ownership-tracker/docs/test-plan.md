# Email Ownership Tracker Test Plan

## Automated Checks

Run from the repository root:

```bash
node --test tools/v1/team/email-ownership-tracker/tests/email-ownership-docs.test.mjs
```

The local test checks that:

- synthetic fixture cases use stable identifiers and contain no production data.
- all documented ownership statuses are represented.
- unowned threads are classified as `needs-owner`.
- transfer cases include both current and previous owners.
- stale cases require review and include an age-based signal.
- documentation includes setup, fixture, limitation, and review guidance.

## Manual Review Checklist

- Confirm all changed files stay under `tools/v1/team/email-ownership-tracker/`.
- Confirm fixture content is synthetic and avoids real sender, recipient,
  customer, mailbox, or teammate data.
- Confirm the status rules in `specs.md` match the fixture vocabulary.
- Confirm no live network calls, secrets, database writes, assignment writes,
  notifications, inbox writes, wallet behavior, Stellar behavior, or app routing
  changes are introduced.
- Confirm future integration boundaries are documented instead of implemented.

## Future Code Coverage

When folder-local service or UI code is added, extend coverage for:

- owner assignment and reassignment transitions.
- stale ownership thresholds.
- empty, loading, error, and success states.
- duplicate owner changes and missing-owner warnings.
- audit history ordering and reviewer notes.

Keep future tests folder-local unless a separate integration issue explicitly
allows app-wide coverage.
