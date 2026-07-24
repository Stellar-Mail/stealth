# Auto Label Suggestion Review Notes

## Scope checklist

- All implementation files live under `tools/v1/individual/auto-label-suggestion/`.
- The tool exposes only a folder-local API through `index.ts`.
- No app shell, routing, database, authentication, wallet, or mail-rendering files are touched.
- No live network calls, secrets, analytics, or production data are introduced.

## Behavior checklist

- `suggestAutoLabels` returns deterministic `success` and `error` results.
- Suggestions are capped at three labels and include label, confidence, reason, and evidence.
- Existing user labels are preserved separately and not duplicated as suggestions.
- Security and Finance rank ahead of lower-risk Newsletter matches.

## Fixture checklist

`fixtures/email-label-cases.json` covers finance, Stellar payment, security, calendar,
newsletter, and mixed action-required scenarios. The unit test keeps those fixtures as
the executable baseline for future UI work.
