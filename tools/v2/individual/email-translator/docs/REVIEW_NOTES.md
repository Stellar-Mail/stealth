# Email Translator Review Notes

## What Changed

- Added deterministic synthetic review scenarios for the isolated Email Translator tool.
- Added a Node built-in fixture contract test that runs without app-wide setup.
- Added this review guide and a folder-local test plan.
- Replaced stale generated text in `specs.md` with a clean contributor-facing specification.
- Updated the README with validation commands and local documentation links.

## Boundary Check

All changed files should stay inside:

```text
tools/v2/individual/email-translator/
```

This change does not mount the tool in the main app, add routes, change inbox behavior, touch wallet or Stellar code, or introduce a live translation provider.

## Suggested Review Flow

1. Inspect the file list and confirm the boundary above.
2. Run:

   ```bash
   node --test tools/v2/individual/email-translator/tests/fixture-contract.test.mjs
   ```

3. Check that `fixtures/review-scenarios.json` uses synthetic email content only.
4. Read `docs/TEST_PLAN.md` and confirm it explains setup, fixture usage, future coverage, and limitations.
5. Confirm `specs.md` no longer contains generated shell/script fragments.

## Acceptance Criteria Mapping

- Tests or test plans live inside the tool folder: `tests/fixture-contract.test.mjs` and `docs/TEST_PLAN.md`.
- Documentation explains independent review: this file and `docs/TEST_PLAN.md`.
- Issue remains isolated from app-wide tests: the test uses Node built-ins and local JSON fixtures.
- Files changed are limited to the tool folder.
- The contribution is self-contained and reviewable without a full app run.

## Follow-Up Work

- Add service tests when `translationService` exists.
- Add hook tests when `useTranslation` and `useLanguageDetect` exist.
- Add component accessibility tests when the UI surface exists.
- Add provider-specific accuracy and safety tests only after a provider has been approved.
