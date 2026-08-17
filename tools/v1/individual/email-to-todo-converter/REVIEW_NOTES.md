# Review Notes

This issue is documentation and test-plan work for the isolated
Email-to-Todo Converter folder.

## What Changed

- Replaced generated placeholder text in `specs.md` with the V1 individual tool
  contract.
- Added a contributor-facing setup, usage, and limitations section to
  `README.md`.
- Added `docs/test-plan.md` with unit, component, and non-goal coverage.
- Added `docs/fixtures.md` with representative email inputs and expected task
  draft outcomes.

## Review Checklist

- All files remain inside `tools/v1/individual/email-to-todo-converter/`.
- No main app, routing, inbox, wallet, database, or design-system integration is
  introduced.
- The test plan covers core extraction behavior, accessibility, validation, and
  review-before-save expectations.
- The fixtures are safe synthetic examples and contain no real personal data.
