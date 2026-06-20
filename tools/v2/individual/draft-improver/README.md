# Draft Improver

This folder is the isolated workspace for the Draft Improver tool.

## Current Hardening Surface

- `services/draft-improver-guards.mjs` validates and bounds draft-improvement requests before future model or UI integration.
- `fixtures/sample-draft-improvement-requests.json` keeps synthetic examples for safe drafts, hostile instructions, secrets, markup, and invalid goals.
- `tests/draft-improver-guards.test.mjs` verifies the local security and performance contract using Node's built-in test runner.
- `docs/SECURITY_AND_PERFORMANCE.md` documents unsafe draft inputs, prompt-injection assumptions, and workload limits.

Run the local checks from the repository root:

```bash
node --test tools/v2/individual/draft-improver/tests/draft-improver-guards.test.mjs
```

## Ownership Boundary

All work for this tool must stay inside:

`text
.\tools\v2\individual\draft-improver\
`

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

See specs.md for the issue categories and contributor expectations.
