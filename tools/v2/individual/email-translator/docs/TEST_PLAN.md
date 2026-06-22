# Email Translator Test Plan

## Scope

This plan covers only the isolated Email Translator workspace:

```text
tools/v2/individual/email-translator/
```

The tool is not wired into the main app yet. Current validation focuses on contributor-ready fixtures, documented review paths, and future test expectations for the planned service, hook, and UI modules.

## Setup

From the repository root, run the folder-local fixture contract test:

```bash
node --test tools/v2/individual/email-translator/tests/fixture-contract.test.mjs
```

No app server, live translation provider, API key, wallet, inbox fixture, or database is required.

## Fixture Inventory

The local scenarios live in:

```text
tools/v2/individual/email-translator/fixtures/review-scenarios.json
```

They cover:

- successful Latin-language translation review
- successful non-Latin source text review
- empty source validation
- unsupported target language validation
- copy-ready output state expectations

The fixture contract test verifies stable ids, distinct source and target languages, review focus notes, and success/error/empty/copy-ready state coverage.

## Future Service Tests

When `services/translationService` and provider modules are implemented, add tests under `tests/` that reuse the local fixtures and verify:

- empty source text is rejected before provider calls
- unsupported language codes are rejected before provider calls
- successful provider responses preserve sender names, dates, amounts, and action requests
- provider failures become normalized recoverable errors
- no fixture requires live network access or production secrets

## Future Hook Tests

When `hooks/useTranslation` and `hooks/useLanguageDetect` are implemented, add hook tests that verify:

- initial idle state
- loading state during translation
- success state with translated text
- recoverable error state
- source and target language changes
- no persistence to main app stores

## Future Component Tests

When component modules are implemented, add component tests that verify:

- source text is visible or intentionally read-only
- language selectors have accessible labels
- translate controls are keyboard operable
- errors are announced in a reviewable way
- copy feedback is exposed without requiring integration with the main mail UI

## Known Limitations

- The tool is architecture-only today, so this plan does not validate real translation accuracy.
- No live provider is approved or configured in this folder.
- Clipboard behavior should be mocked in future component tests.
- Main inbox, compose, routing, wallet, Stellar, and database integration are intentionally out of scope.

## Independent Review

Reviewers can validate this issue without running the full app:

1. Confirm all changed files stay under `tools/v2/individual/email-translator/`.
2. Run the fixture contract test command above.
3. Read `fixtures/review-scenarios.json` and confirm all examples are synthetic.
4. Confirm the plan documents setup, usage, fixtures, and limitations.
