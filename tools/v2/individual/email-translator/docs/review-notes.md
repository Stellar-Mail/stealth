# Email Translator Review Notes

## What This Contribution Covers

This contribution adds contributor-facing documentation and fixture coverage for
the isolated Email Translator workspace. It gives reviewers a local validation
path before this tool is connected to a real translation provider or the main
mail app.

Reviewers should expect:

- a deterministic synthetic fixture with representative translation scenarios.
- a local Node test that validates the fixture and documentation contract.
- a test plan that covers current review steps and future service/UI coverage.
- explicit limitations for inbox, provider, routing, persistence, and secret
  handling.

## What Is Out Of Scope

This issue does not add:

- live translation API calls, LLM calls, or provider credentials.
- inbox reads, mailbox writes, or mail rendering changes.
- database schema changes or persistence.
- app routing, dashboard placement, authentication, wallet, Stellar, or shared
  design-system changes.
- production sender, recipient, mailbox, or customer data.

## Reviewer Flow

1. Run the local Node test from the repository root.
2. Inspect `fixtures/review-scenarios.json` and confirm all cases are synthetic.
3. Confirm risky or unsupported scenarios require manual review.
4. Confirm `docs/test-plan.md` names both current checks and future coverage
   gaps.
5. Confirm the PR changes only files inside this tool folder.

## Known Limitations

The fixture documents expected review behavior before a production translation
provider is approved. Future integration should pass email body text into this
tool as caller-owned input instead of letting the tool read from a mailbox.
