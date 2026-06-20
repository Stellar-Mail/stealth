# Email Translator

This folder is the isolated workspace for the Email Translator tool.

## Current Hardening Surface

- `services/email-translator-guards.mjs` validates translation requests before any future model or UI integration.
- `fixtures/sample-translation-requests.json` keeps deterministic synthetic review cases for safe, malformed, hostile, and large messages.
- `tests/email-translator-guards.test.mjs` verifies the local security and performance contract with Node's built-in test runner.
- `docs/SECURITY_AND_PERFORMANCE.md` documents threat assumptions, unsafe inputs, and workload limits.

Run the local checks from the repository root:

```bash
node --test tools/v2/individual/email-translator/tests/email-translator-guards.test.mjs
```

## Ownership Boundary

All work for this tool must stay inside:

`text
.\tools\v2\individual\email-translator\
`

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

See specs.md for the issue categories and contributor expectations.
