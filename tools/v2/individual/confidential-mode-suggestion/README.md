# Confidential Mode Suggestion

This folder is the isolated workspace for the Confidential Mode Suggestion tool.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v2/individual/confidential-mode-suggestion/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet
core, Stellar core, database schema, or existing design system unless a future
integration issue explicitly allows it.

## Safety and Performance Guard Rails

This folder includes a local guard helper for future confidential-mode
suggestions:

- `services/confidential-mode-guards.mjs` normalizes subject, body, recipient,
  attachment, and context input before scoring.
- `tests/confidential-mode-guards.test.mjs` covers valid input, empty input,
  large input caps, attachment metadata handling, high-signal recommendations,
  and low-signal review behavior.
- `docs/SECURITY_AND_PERFORMANCE.md` documents unsafe input categories, limits,
  and review checks.
- `docs/REVIEW_NOTES.md` maps the implementation to issue #477.

Suggested local check:

```bash
node --test tools/v2/individual/confidential-mode-suggestion/tests/confidential-mode-guards.test.mjs
```

## Known Limitations

- This contribution does not mount the tool in the main app.
- The recommendation helper is deterministic and conservative.
- Live email ingestion, sending, persistence, wallet flows, and database writes
  remain out of scope.

See `specs.md` for the issue categories and contributor expectations.
