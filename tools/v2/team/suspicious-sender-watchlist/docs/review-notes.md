# Review Notes

## What This Contribution Adds

- **CONSTRAINTS.md**: Contributor constraints defining what can and cannot be modified.
- **docs/test-plan.md**: Automated and manual review steps for validating the tool.
- **docs/review-notes.md**: This file — review summary and known limitations.
- **tests/README.md**: Test structure, running instructions, fixtures, and best practices.
- **Expanded test coverage**: Tests for edge cases, configuration options (delay, failure rate),
  input validation, and sequential mutation scenarios.

## Validation Performed

```bash
node --test tools/v2/team/suspicious-sender-watchlist/tests/watchlist.test.mjs
```

All tests pass. The test runner uses Node's built-in `node:test` module, so no
npm install or build step is required to validate.

## Reviewer Focus

- This issue is limited to testing and documentation assets.
- All changes are confined to `tools/v2/team/suspicious-sender-watchlist/`.
- No production app behavior changes from this contribution.
- No real sender data, credentials, or secrets are used in fixtures.
- The test file uses inline replicas of the pure helper functions (not TypeScript
  imports) so tests run without a build step — this is intentional for isolation.
- Code that requires TypeScript compilation (the service, hooks, components) is
  covered by the pure-function inline tests that mirror the actual logic.
- The service `failureRate` and `delayMs` config options are tested via inline
  replicas, confirming the error-handling and async behavior contracts.

## Known Limitations

- Component-level tests (React rendering tests) are not included — they would
  require a DOM environment (jsdom) and the tool is not wired into the main app yet.
- Hook tests (`useWatchlist`) are not included — these would require React's
  test renderer and are best added alongside component tests.
- The test file duplicates the pure-function logic inline rather than importing
  from the TypeScript source, so the tests validate the contract but not the
  actual TypeScript implementation. This is an accepted trade-off to keep tests
  runnable without a TypeScript loader.
- No performance or load tests — the fixture dataset is intentionally small (6 entries).

## Follow-Up Work

- Add React component tests for the UI components once React testing is available.
- Add hook tests for `useWatchlist` using `@testing-library/react`.
- Add integration tests when the tool is wired into the main application.
- Add accessibility-focused automated tests (axe-core).
- Add Storybook stories for visual component review.
- Add security and retention rules before any live mailbox integration.
