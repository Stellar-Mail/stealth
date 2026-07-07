# Email Translator Core Contract

This document describes the folder-local Email Translator core engine. The
implementation is deterministic and offline: it uses a local phrasebook and word
maps for reviewable behavior, and it does not call live translation APIs, LLMs,
mailboxes, databases, wallets, Stellar services, or production systems.

## Inputs

`translateEmail(request, options)` accepts:

- `id`: stable local request identifier.
- `sourceText`: required email body text.
- `sourceLanguage`: language code or `auto`.
- `targetLanguage`: required language code.

Supported language codes are `en`, `es`, `fr`, `de`, and `pt`. The local mock
provider intentionally supports only a small set of pairs. Unsupported pairs
return a structured error instead of making a network call.

`options.now` fixes the generated timestamp for deterministic tests.
`options.maxTextChars` clips large source text for local review.

## Outputs

Successful calls return:

- `status: "ready"`
- `isLoading: false`
- `error: null`
- `result.provider: "local-deterministic-phrasebook"`
- `result.sourceLanguage` and `result.targetLanguage`
- `result.detectedLanguage` and `result.detectionConfidence`
- `result.translatedText`
- `result.segments` preserving paragraph separators for future UI rendering
- `result.untranslatedTerms` for reviewer follow-up
- `result.warnings` for clipping or preserved terms
- `result.metrics` with character counts, word counts, replacements, and
  confidence
- `result.reviewRequired` when confidence is low or terms remain untranslated

## Loading State

`createEmailTranslatorLoadingState(message)` returns:

- `status: "loading"`
- `isLoading: true`
- `error: null`
- `result: null`
- `message`: caller-visible progress text.

## Error State

Invalid requests do not throw. They return:

- `status: "error"`
- `isLoading: false`
- `error.code: "email-translator-error"`
- `error.messages`: validation or translation contract messages.
- `result: null`
- `requestId`: local request id when available.

The validator rejects empty source text, unsupported languages, overly large
input, and active markup such as script tags or `javascript:` URLs.

## Local Review Command

Run from the repository root:

```bash
node --test tools/v2/individual/email-translator/tests/email-translator-core.test.mjs
```
