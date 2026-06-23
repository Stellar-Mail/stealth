# Invoice Approval Workflow

Invoice Approval Workflow is an isolated V2 team tool workspace for reviewing
invoice submissions before any future mail-app or accounting integration.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v2/team/invoice-approval-workflow/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet
core, Stellar core, database schema, or shared design system unless a future
integration issue explicitly allows it.

## Reviewer Setup

Run the folder-local tests from the repository root:

```bash
node tools/v2/team/invoice-approval-workflow/tests/invoice-guards.test.mjs
```

The tests validate security and performance guards against deterministic local
fixtures. No app install, live network call, production invoice, or payment data
is required.

## Documentation Map

- `guards/invoice-guards.mjs` exposes pure validation and performance guards.
- `fixtures/sample-invoices.json` contains synthetic valid, hostile, and edge
  case examples.
- `docs/security-and-performance.md` documents threat assumptions, limits, and
  review guidance.
- `tests/invoice-guards.test.mjs` validates the folder-local guard contract.

## Known Limitations

- This contribution does not add app UI or accounting-system integration.
- Invoice approval state is represented through local validation only.
- Payment rails, bank details, persistence, authentication, and mail rendering
  remain out of scope.
