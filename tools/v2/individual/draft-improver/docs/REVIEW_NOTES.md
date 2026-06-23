# Draft Improver Review Notes

## Issue

Addresses issue #488: Draft Improver - Testing and documentation.

## What Changed

- Added deterministic sample draft fixtures for support, sales, and internal-review scenarios.
- Added a folder-local Node test that validates the fixture shape and reviewability contract.
- Added a test plan that documents current fixture coverage and future service-level tests.
- Linked the review assets from the folder README.

## Acceptance Criteria Mapping

| Acceptance Criteria | Evidence |
| --- | --- |
| Tests or test plans live inside the tool folder. | `tests/draft-improver-fixtures.test.mjs` and `docs/TEST_PLAN.md` are both under `tools/v2/individual/draft-improver/`. |
| Documentation explains independent review. | `docs/TEST_PLAN.md` describes scope, manual review, and future coverage without app-wide integration. |
| Issue remains isolated from app-wide tests. | No files outside the Draft Improver folder are required for the fixture test. |
| Files changed are limited to the implementation folder. | All changed files stay under `tools/v2/individual/draft-improver/`. |
| Contribution is a self-contained mini-product change. | Reviewers can inspect fixtures and run the local Node test without wiring the tool into the app. |

## Validation

Run from the repository root:

```bash
node --test tools/v2/individual/draft-improver/tests/draft-improver-fixtures.test.mjs
```

Expected result: one passing test confirming the fixture contract.

## Known Limitations

- This does not implement the final Draft Improver engine or UI.
- The fixtures are synthetic and contain no real user email data.
- App-wide integration, shared navigation, authentication, and inbox wiring remain out of scope for this issue.
