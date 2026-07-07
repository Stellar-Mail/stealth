# Email Template Library Specs

## Purpose

Provide a folder-local V2 individual tool for storing, searching, rendering, and
reusing personal email templates.

The core service must stay framework-free so future UI and hook issues can reuse
the behavior without linking this tool into the main application.

## Scope

- Release tier: V2
- Audience: individual
- Folder ownership: `tools/v2/individual/email-template-library/`

This is a self-contained tooling workspace. Do not wire this tool into the main
app, routing, inbox architecture, wallet core, Stellar integration, database
schema, or design system unless a future integration issue explicitly allows it.

## Contributor Boundary

All work for this tool should stay in:

```
tools/v2/individual/email-template-library/
```

## Required Issue Categories

- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation

## Internal Structure

- `types/` for local TypeScript-style contracts.
- `services/` for validation, CRUD, search, rendering, and state helpers.
- `fixtures/` for deterministic synthetic templates and categories.
- `tests/` for folder-local executable checks.
- `docs/` for the core API contract and known limitations.
- `hooks/` and `components/` can be added by future UI issues.

## Review Contract

Current and future work should keep these behaviors verifiable without the main
application:

- Templates and categories are validated before they enter service state.
- Variable placeholders use declared `{{variableKey}}` syntax.
- Rendering substitutes only declared variables and reports missing values.
- Search is deterministic across name, subject, body, category, and tags.
- State helpers expose loading, success, empty, and error states for future UI
  work.
- Public API exports stay folder-local through `index.mjs`.

## Out of Scope

- Main app routes, compose integration, inbox wiring, or design-system changes.
- Database persistence, cookies, analytics, or remote sync.
- Live network calls, secrets, production data, wallet, Stellar, or payment
  integrations.
