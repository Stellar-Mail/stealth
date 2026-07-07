# Invoice Approval Workflow Review Notes

## What This Contribution Covers

This contribution adds contributor-facing documentation and fixture coverage for
the isolated Invoice Approval Workflow folder. It gives reviewers a local
validation path without connecting to production invoices, payment systems, or
the main application.

Reviewers should expect:

- a repaired README and specs file for the folder-local workflow.
- a deterministic synthetic fixture with representative approval statuses.
- a local Node test that validates fixture and documentation requirements.
- clear limitations for future payment, accounting, inbox, and routing work.

## What Is Out Of Scope

This issue does not add:

- payment execution, deposits, trades, or wallet signing.
- Stellar transaction behavior or contract calls.
- database schema changes or accounting exports.
- inbox reads, mailbox writes, or mail rendering changes.
- app routing, dashboard placement, authentication, or shared design-system
  changes.
- production vendor, customer, invoice, or payment data.

## Reviewer Flow

1. Run the local Node test from the repository root.
2. Inspect `fixtures/sample-approval-cases.json` and confirm all cases are
   synthetic.
3. Compare fixture statuses with the rules in `specs.md`.
4. Confirm `docs/test-plan.md` names both current checks and future coverage
   gaps.
5. Confirm the PR changes only files inside this tool folder.

## Known Limitations

The fixture documents the review contract before this folder has a production
approval service. A future feature issue should implement scoring and approval
state logic inside this folder first; main app integration should remain a
separate follow-up after the isolated model is accepted.
