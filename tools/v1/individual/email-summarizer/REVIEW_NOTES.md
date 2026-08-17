# Review Notes

This issue is documentation and test-plan work for the isolated Email Summarizer
folder.

## What Changed

- Replaced generated placeholder text in `specs.md` with the V1 individual tool
  contract.
- Added a contributor-facing setup, usage, and limitations section to
  `README.md`.
- Added `docs/test-plan.md` with unit, component, and non-goal coverage.
- Added `docs/fixtures.md` with representative email inputs and expected
  summary outcomes.

## Review Checklist

- All files remain inside `tools/v1/individual/email-summarizer/`.
- No main app, routing, inbox, wallet, database, or design-system integration is
  introduced.
- The test plan covers summary length, action item extraction, validation,
  source metadata preservation, and factuality expectations.
- The fixtures are safe synthetic examples and contain no real personal data.
