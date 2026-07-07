# Escalation Tool Review Notes

## What This Contribution Covers

This contribution adds contributor-facing documentation and fixture coverage for
the isolated Escalation Tool workspace. The tool is treated as a self-contained
mini-product and is not connected to the main app.

Reviewers should expect:

- a repaired README and specs file for the folder-local workflow.
- a deterministic fixture with representative escalation states.
- a local Node test that validates the fixture and documentation contract.
- clear limitations for future inbox, routing, notification, and persistence
  work.

## What Is Out Of Scope

This issue does not add:

- main app routing or dashboard registration.
- inbox reads, mailbox writes, or mail rendering changes.
- notification delivery, ticket creation, or assignment side effects.
- database schema changes or persistence.
- wallet, Stellar, auth, or payment behavior.
- production customer data or live network calls.

## Reviewer Flow

1. Run the local Node test from the repository root.
2. Read `fixtures/sample-escalation-cases.json` and confirm all cases are
   synthetic.
3. Compare fixture statuses with the rules in `specs.md`.
4. Confirm `docs/test-plan.md` names the current checks and future coverage
   gaps.
5. Confirm the PR changes only files inside this tool folder.

## Known Limitations

The fixture documents the expected review contract before core scoring logic is
implemented. A future feature issue should add service-level logic and reuse this
status vocabulary instead of inventing a separate escalation model. Main app
integration should remain a separate follow-up after the folder-local model is
accepted.
