# Email Ownership Tracker

Email Ownership Tracker is an isolated V1 team workspace for reviewing who owns
email threads, when ownership changed, and which handoffs still need team
attention. It is not wired into the main app yet.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v1/team/email-ownership-tracker/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

## Reviewer Setup

This issue adds folder-local documentation, synthetic fixtures, and a
zero-dependency Node contract test. Run from the repository root:

```bash
node --test tools/v1/team/email-ownership-tracker/tests/email-ownership-docs.test.mjs
```

The test validates the local fixture and documentation contract without using
main app test helpers.

## Documentation Map

- `specs.md` defines the ownership review model and contributor boundary.
- `docs/test-plan.md` lists automated and manual review checks.
- `docs/review-notes.md` summarizes reviewer expectations and limitations.
- `fixtures/ownership-review-cases.json` provides synthetic ownership scenarios.
- `tests/email-ownership-docs.test.mjs` validates the fixture and documentation
  contract.

## Current Limitations

- No inbox ingestion, mailbox mutation, team assignment write, notification, or
  database persistence is included.
- No app routing, dashboard registration, wallet, Stellar, auth, or shared
  design-system integration is included.
- Fixture content is synthetic and should remain folder-local.
