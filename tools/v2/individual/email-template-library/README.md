# Email Template Library

This folder is the isolated workspace for the Email Template Library tool. The
current implementation provides the core template service only; it is not
mounted in the main app.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v2/individual/email-template-library/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

## Review Map

- `services/template-service.mjs` contains the folder-local pure template engine.
- `index.mjs` exposes the future UI-facing API surface.
- `fixtures/templates.json` provides deterministic demo templates and categories.
- `tests/template-service.test.mjs` covers validation, CRUD, search, and rendering.
- `docs/contract.md` documents inputs, outputs, loading states, and error states.
- `DATA_OWNERSHIP.md`, `MODULE_BOUNDARIES.md`, and `INTEGRATION_CONSTRAINTS.md` define the isolation model.

## Current Behavior

The service stores templates in memory, validates template payloads, searches by
name/category/content, extracts `{{variable}}` placeholders, and renders declared
variables with caller-provided values. Missing values are reported instead of
being guessed.

The engine is pure and local. It does not call live services, read production
mail, require credentials, persist data, or change any main app behavior.
