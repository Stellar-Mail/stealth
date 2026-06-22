# Invoice Approval Workflow Review Notes

## What Changed

- Added deterministic synthetic invoice approval scenarios.
- Added a Node built-in fixture contract test for local validation.
- Added a folder-local test plan with setup, fixture inventory, future coverage, and known limitations.
- Added this independent review guide.
- Replaced stale generated text in `specs.md` with a clean contributor-facing specification.
- Expanded the README with local validation instructions and documentation links.

## Boundary Check

All changed files should stay inside:

```text
tools/v2/team/invoice-approval-workflow/
```

This change does not mount the tool in the main app, add routes, touch inbox behavior, change wallet or Stellar code, change database schema, or add any live payment provider.

## Suggested Review Flow

1. Inspect the file list and confirm the boundary above.
2. Run:

   ```bash
   node --test tools/v2/team/invoice-approval-workflow/tests/fixture-contract.test.mjs
   ```

3. Confirm `fixtures/approval-scenarios.json` uses synthetic vendors and invoices.
4. Confirm `docs/TEST_PLAN.md` explains setup, fixtures, future tests, and limitations.
5. Confirm `specs.md` no longer contains generated shell/script fragments.

## Acceptance Criteria Mapping

- Tests or test plans live inside the tool folder: `tests/fixture-contract.test.mjs` and `docs/TEST_PLAN.md`.
- Documentation explains independent review: this file and `docs/TEST_PLAN.md`.
- Issue remains isolated from app-wide tests: the test uses Node built-ins and local JSON fixtures.
- Files changed are limited to the tool folder.
- The contribution is self-contained and reviewable without a full app run.

## Follow-Up Work

- Add service tests when invoice validation and state transition helpers exist.
- Add hook tests when the review state hook exists.
- Add component accessibility tests when the UI surface exists.
- Add integration tests only after a future issue explicitly connects this tool to app data or payment rails.
