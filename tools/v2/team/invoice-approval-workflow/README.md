# Invoice Approval Workflow

The Invoice Approval Workflow is an isolated V2 team tool for reviewing invoice requests before payment approval. It is intended to model team-local review states, approval rules, audit notes, and rejection reasons without reading from or writing to the main mail app.

## Current Status

**Local review assets only - implementation deferred.** This folder contains contributor documentation, synthetic invoice review fixtures, and a fixture contract test. No app integration, live payment flow, wallet interaction, or external invoice provider is implemented here.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v2/team/invoice-approval-workflow/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

## Folder Structure

```text
- README.md
- specs.md
- fixtures/approval-scenarios.json
- tests/fixture-contract.test.mjs
- docs/TEST_PLAN.md
- docs/REVIEW_NOTES.md
```

See [specs.md](./specs.md) for contributor boundaries and expected modules.
See [docs/TEST_PLAN.md](./docs/TEST_PLAN.md) for setup, fixtures, future coverage, and known limitations.
See [docs/REVIEW_NOTES.md](./docs/REVIEW_NOTES.md) for independent validation notes.

## Local Validation

Run the folder-local fixture contract test from the repository root:

```bash
node --test tools/v2/team/invoice-approval-workflow/tests/fixture-contract.test.mjs
```

This validates synthetic approval scenarios only. It does not run app-wide tests, process real invoices, trigger payments, or require secrets.
