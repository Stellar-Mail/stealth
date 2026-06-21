# Email Translator Core Engine Notes

## Scope

This folder-local engine models the core translation workflow without integrating
with the main app or calling a live translation provider.

## Inputs

- `sourceText`: required email body, normalized for whitespace and capped at
  12,000 characters.
- `sourceLanguage`: optional, defaults to `auto`.
- `targetLanguage`: optional, defaults to `english`.
- `preserveTone`: optional, defaults to `true`.

## Outputs

- `normalizeTranslatorInput` returns either a normalized value or a structured
  validation error.
- `createTranslationJob` returns a deterministic job id, language settings,
  preview text, warning categories, and requested translation steps.
- `buildTranslationDraft` returns translated text plus a review checklist for
  names, dates, links, amounts, sensitive wording, and tone.

## Deterministic Fixtures

The local Node test file covers:

- valid normalization,
- empty text rejection,
- oversized input rejection,
- same-language rejection,
- stable job ids,
- warning categories for links, dates, currency, and numbers,
- success and empty draft results.

## Integration Boundary

No network calls, secrets, production data, inbox routing, wallet behavior,
Stellar integration, database schema, or shared design-system files are used.
Future integration work can call this engine from a UI or provider adapter
without changing its validation contract.
