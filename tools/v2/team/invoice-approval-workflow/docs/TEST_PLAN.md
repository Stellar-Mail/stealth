# Invoice Approval Workflow Test Plan

## Scope

This plan covers only the isolated team tool workspace:

```text
tools/v2/team/invoice-approval-workflow/
```

The tool is not connected to the main app, inbox, wallet, Stellar code, database, or any live payment rail. Current validation focuses on local fixtures, documented review paths, and future test expectations.

## Setup

From the repository root, run:

```bash
node --test tools/v2/team/invoice-approval-workflow/tests/fixture-contract.test.mjs
```

No app server, payment account, vendor account, API key, mailbox fixture, or database is required.

## Fixture Inventory

The synthetic review scenarios live in:

```text
tools/v2/team/invoice-approval-workflow/fixtures/approval-scenarios.json
```

They cover:

- a standard approval
- a missing purchase order request for more information
- a large contract blocked for policy review
- a duplicate invoice rejection
- a near-due foreign currency invoice that stays pending

The fixture contract test verifies stable ids, positive amounts, ISO-style due dates, three-letter currencies, review signals, all planned workflow states, and multi-currency coverage.

## Future Service Tests

When local service modules are implemented, add tests under `tests/` that reuse the fixtures and verify:

- duplicate invoices are rejected before payment approval
- missing purchase orders move to `needs_information`
- high-value invoices move to `blocked`
- approved invoices still produce review audit notes
- no scenario triggers live payment execution

## Future Hook Tests

When hooks are implemented, add hook tests that verify:

- initial queue state
- selected invoice state
- state transitions across review actions
- recoverable validation errors
- no persistence to main app stores

## Future Component Tests

When UI components are implemented, add component tests that verify:

- invoice amount, vendor, due date, and purchase order are visible
- approval/rejection controls are keyboard operable
- rejection and blocked states require a visible reason
- pending and needs-information states are announced clearly
- audit notes remain visible without mounting the main app

## Known Limitations

- This plan does not validate a real payment or payment provider.
- The current fixture contract test validates review scenario structure, not production workflow logic.
- The tool has no approved integration with mailbox, finance, wallet, Stellar, or database modules.
- All invoice content is synthetic and should stay synthetic until a future integration issue defines data handling rules.

## Independent Review

Reviewers can validate this issue without running the full app:

1. Confirm all changed files stay under `tools/v2/team/invoice-approval-workflow/`.
2. Run the fixture contract test command above.
3. Confirm the fixtures are synthetic and cover all planned workflow states.
4. Confirm this plan documents setup, usage, fixtures, future coverage, and limitations.
