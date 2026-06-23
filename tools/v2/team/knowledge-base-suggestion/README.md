# Knowledge Base Suggestion

This folder is the isolated workspace for the Knowledge Base Suggestion tool.
The current implementation provides the core suggestion engine only; it is not
mounted in the main app.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v2/team/knowledge-base-suggestion/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

## Review Map

- `engine.mjs` contains the folder-local pure suggestion engine.
- `index.mjs` exposes the future UI-facing API surface.
- `fixtures/kb-suggestions.json` provides deterministic local article fixtures.
- `tests/engine.test.mjs` covers validation, ranking, empty states, and large input warnings.
- `docs/contract.md` documents inputs, outputs, loading states, and error states.
- `specs.md` records the tool scope and issue categories.

## Current Behavior

The engine scores local knowledge base articles against an inbound mail or
support context. It uses deterministic token overlap, tag matching, optional
team matching, and article priority. It returns reviewable suggestions with
matched terms and reasons.

The engine is pure and local. It does not call live services, read production
mail, require credentials, or persist data.
