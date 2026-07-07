# Invoice Approval Workflow Test Plan

## Automated Checks

Run from the repository root:

```bash
node --test tools/v2/team/invoice-approval-workflow/tests/invoice-approval-docs.test.mjs
```

The local test checks that:

- synthetic fixture cases use stable identifiers and contain no production data.
- all documented approval statuses are represented.
- blocked cases require missing details to be supplied before approval.
- rejected cases have a rejection reason in their risk flags.
- ready-for-approval cases do not require manual review.
- documentation includes setup, fixture, limitation, and review guidance.

## Manual Review Checklist

- Confirm all changes stay under `tools/v2/team/invoice-approval-workflow/`.
- Confirm fixture content is synthetic and avoids real vendor, customer, invoice,
  or payment data.
- Confirm the status rules in `specs.md` match the fixture vocabulary.
- Confirm no live network calls, secrets, database writes, payment execution,
  wallet behavior, Stellar behavior, inbox writes, or app routing changes are
  introduced.
- Confirm future integration boundaries are documented instead of implemented.

## Future Code Coverage

When folder-local core logic is added or reconciled with future implementation
work, extend coverage for:

- amount and currency normalization.
- purchase order and receipt matching.
- duplicate invoice checks.
- department approval threshold rules.
- loading, empty, error, and success states for future UI work.

Keep future tests folder-local unless a separate integration issue explicitly
allows app-wide coverage.
