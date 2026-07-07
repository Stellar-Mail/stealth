# Email Ownership Tracker Review Notes

## What This Contribution Covers

This contribution adds contributor-facing documentation and fixture coverage for
the isolated Email Ownership Tracker folder. It gives reviewers a local
validation path without connecting to production inbox data, assignment systems,
or the main application.

Reviewers should expect:

- a repaired README and specs file for the folder-local workflow.
- a deterministic synthetic fixture with representative ownership statuses.
- a local Node test that validates fixture and documentation requirements.
- clear limitations for future inbox, notification, assignment, and persistence
  work.

## What Is Out Of Scope

This issue does not add:

- inbox reads, mailbox writes, or mail rendering changes.
- owner assignment side effects or notification delivery.
- database schema changes or persistence.
- app routing, dashboard placement, authentication, wallet, Stellar, or shared
  design-system changes.
- production sender, recipient, mailbox, customer, or teammate data.

## Reviewer Flow

1. Run the local Node test from the repository root.
2. Inspect `fixtures/ownership-review-cases.json` and confirm all cases are
   synthetic.
3. Compare fixture statuses with the rules in `specs.md`.
4. Confirm `docs/test-plan.md` names both current checks and future coverage
   gaps.
5. Confirm the PR changes only files inside this tool folder.

## Known Limitations

The fixture documents the review contract before this folder has production
assignment behavior. A future feature issue should implement ownership state
logic inside this folder first; main app integration should remain a separate
follow-up after the isolated model is accepted.
