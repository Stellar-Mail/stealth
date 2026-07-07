# Email Translator Test Plan

## Automated Checks

Run from the repository root:

```bash
node --test tools/v2/individual/email-translator/tests/email-translator-docs.test.mjs
```

The local test checks that:

- review scenarios use stable ids and contain no production email data.
- each scenario names a supported source and target language.
- every scenario documents an expected review state.
- unsupported or risky translation cases require manual review.
- documentation includes setup, fixture, limitation, and integration-boundary
  guidance.

## Manual Review Checklist

- Confirm all changed files stay under `tools/v2/individual/email-translator/`.
- Confirm review fixtures contain no production data.
- Confirm fixtures are synthetic and avoid real mailbox, sender, recipient, or
  customer data.
- Confirm source text is treated as caller-provided content, not fetched from
  the inbox.
- Confirm the review notes keep live translation providers, API keys, secrets,
  inbox integration, persistence, and main app routing out of scope.
- Confirm future service or UI work can reuse the fixture statuses without
  changing this issue's review vocabulary.

## Future Code Coverage

When a folder-local translator service or UI surface is available on the target
branch, extend coverage for:

- source language auto-detection behavior.
- supported and unsupported language pairs.
- loading, empty, error, and success states.
- copy-to-clipboard affordances.
- provider errors, timeout handling, and unsafe markup warnings.

Keep future tests folder-local unless a separate integration issue explicitly
allows app-wide coverage.
