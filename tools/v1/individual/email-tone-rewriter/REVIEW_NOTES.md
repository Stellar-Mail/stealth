# Review Notes

This issue is documentation and test-plan work for the isolated Email Tone
Rewriter folder.

## What Changed

- Replaced generated placeholder text in `specs.md` with the V1 individual tool
  contract.
- Added a contributor-facing setup, usage, and limitations section to
  `README.md`.
- Added `docs/test-plan.md` with unit, component, and non-goal coverage.
- Added `docs/fixtures.md` with representative rewrite inputs and expected
  outcomes.

## Review Checklist

- All files remain inside `tools/v1/individual/email-tone-rewriter/`.
- No main app, routing, inbox, wallet, database, compose, or design-system
  integration is introduced.
- The test plan covers supported tones, validation, factual preservation, length
  constraints, review-before-action, and non-destructive cancellation.
- The fixtures are safe synthetic examples and contain no real personal data.
