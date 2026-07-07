# Invoice Approval Workflow

Invoice Approval Workflow is an isolated V2 team workspace for reviewing
invoice-like email requests before any future approval routing or accounting
integration is added.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v2/team/invoice-approval-workflow/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

## Reviewer Setup

This issue adds folder-local documentation, synthetic fixtures, and a
zero-dependency Node contract test. Run from the repository root:

```bash
node --test tools/v2/team/invoice-approval-workflow/tests/invoice-approval-docs.test.mjs
```

The test validates the local fixture and documentation contract without using
main app test helpers.

## Documentation Map

- `specs.md` defines the status model, fixture contract, and contributor
  boundary.
- `docs/test-plan.md` lists automated and manual review checks.
- `docs/review-notes.md` summarizes reviewer expectations and limitations.
- `fixtures/sample-approval-cases.json` provides synthetic invoice approval
  scenarios.
- `tests/invoice-approval-docs.test.mjs` validates the fixture and documentation
  contract.

## Current Limitations

- No inbox ingestion, payment execution, vendor update, accounting export, or
  database persistence is included.
- No app routing, dashboard registration, wallet, Stellar, auth, or shared
  design-system integration is included.
- Fixture content is synthetic and should remain folder-local.
