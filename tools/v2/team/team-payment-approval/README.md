# Team Payment Approval

Team Payment Approval is an isolated V2 team tool workspace for reviewing
payment requests before they move to a future Stellar or finance integration.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v2/team/team-payment-approval/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet
core, Stellar core, database schema, or shared design system unless a future
integration issue explicitly allows it.

## Reviewer Setup

This issue adds folder-local documentation, fixtures, and a standalone Node test.
No app install is required to review the contribution.

Run from the repository root:

```bash
node --test tools/v2/team/team-payment-approval/tests/payment-approval-fixtures.test.mjs
```

The test validates the sample payment approval fixture against the local review
contract described in `specs.md`.

## Approval Workflow

1. Capture payment requests from team communication or mailbox records.
2. Normalize amount, currency, requester, vendor, and required approvers.
3. Route each request to `submitted`, `needs-review`, `blocked`, or `approved`.
4. Preserve a source record link for auditability.
5. Flag incomplete or policy-sensitive requests for human review.

## Fixtures

The folder-local fixture at `fixtures/sample-payment-approvals.json` contains:

- a standard vendor reimbursement that is ready for first approval
- a high-value vendor payment requiring finance review
- a blocked request missing required documentation
- an approved contractor payment with complete approval evidence

The fixture intentionally uses `example.test` data and synthetic request ids so
contributors can validate behavior without using real financial information.

## Documentation Map

- `specs.md` defines the local approval request contract and scope.
- `docs/test-plan.md` lists automated and manual review steps.
- `docs/review-notes.md` explains validation and known limits.
- `tests/payment-approval-fixtures.test.mjs` validates the fixture contract.

## Known Limitations

- This contribution does not add app UI or payment execution code.
- Approval logic is represented through fixture expectations only.
- Wallet, Stellar, bank, tax, invoice storage, and notification behavior remain
  out of scope for this isolated V2 folder.
