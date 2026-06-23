# Legal and Compliance Review Flag

This folder is the isolated workspace for the Legal and Compliance Review Flag
tool. The current implementation provides the core review-flag engine only; it
is not mounted in the main app.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v2/team/legal-and-compliance-review-flag/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

## Review Map

- `review-engine.mjs` contains the folder-local pure review flag engine.
- `index.mjs` exposes the future UI-facing API surface.
- `fixtures/review-cases.json` provides deterministic local cases.
- `tests/review-engine.test.mjs` covers validation, classification, and empty states.
- `docs/contract.md` documents inputs, outputs, loading states, and error states.
- `specs.md` records the tool scope and issue categories.

## Current Behavior

The engine evaluates local mail or document-review context against a deterministic
rule set. It flags legal/compliance-sensitive messages, assigns severity, returns
matched terms, and suggests next actions for reviewers.

The engine is pure and local. It does not call live services, read production
mail, require credentials, persist data, or change any main app behavior.
