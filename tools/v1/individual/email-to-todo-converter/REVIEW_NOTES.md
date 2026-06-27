# Review Notes

This issue covers the isolated Email-to-Todo Converter implementation,
including docs, deterministic extraction behavior, and test coverage.

## What Changed

- Replaced generated placeholder text in `specs.md` with the V1 individual tool
  contract.
- Added a contributor-facing setup, usage, and limitations section to
  `README.md`.
- Added `docs/test-plan.md`, `docs/API.md`, and `docs/fixtures.md` to document
  the local contract.
- Added the deterministic UI helpers and review-first component under `ui/`.

## Review Checklist

- All files remain inside `tools/v1/individual/email-to-todo-converter/`.
- No main app, routing, inbox, wallet, database, or design-system integration is
  introduced.
- The test plan covers core extraction behavior, accessibility, validation, and
  review-before-save expectations.
- The fixtures are safe synthetic examples and contain no real personal data.
