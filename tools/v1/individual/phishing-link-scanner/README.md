# Phishing Link Scanner

V1 individual tool workspace for reviewing email links before a user opens
them.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v1/individual/phishing-link-scanner/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

## Intended Use

- Inspect normalized links extracted from an email subject and body.
- Flag suspicious URL patterns, mismatched display text, and high-risk domains.
- Return a reviewable result that helps the user decide whether to open a link.
- Keep the scanner advisory; it must not click, fetch, rewrite, quarantine, or
  delete links automatically.

## Risk Labels

- `blocked`: link should not be opened without additional user review.
- `suspicious`: link has one or more phishing indicators.
- `unknown`: not enough context to classify safely.
- `safe`: no configured phishing indicators were found.

## Testing Focus

Use `docs/test-plan.md` and `docs/fixtures.md` to cover display-text mismatch,
punycode, URL shorteners, credential-reset lures, trusted-domain allowlists,
benign newsletters, empty input, and deterministic scoring.
