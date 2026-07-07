# Knowledge Base Suggestion Specs

## Purpose

Suggest internal knowledge base articles from a team-mail or support context
using deterministic folder-local logic.

The tool helps future UI work show likely articles for a message thread without
connecting to the main app, inbox, database, or external search provider.

## Scope

- Release tier: V2
- Audience: team
- Folder ownership: `tools/v2/team/knowledge-base-suggestion/`

This is a self-contained tooling workspace. Do not wire this tool into the main
app, routing, inbox architecture, wallet core, Stellar integration, database
schema, or design system unless a future integration issue explicitly allows it.

## Contributor Boundary

All work for this tool should stay in:

```
tools/v2/team/knowledge-base-suggestion/
```

## Required Issue Categories

- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation

## Internal Structure

- `services/` for deterministic validation, scoring, ranking, and mock service
  behavior.
- `fixtures/` for synthetic local article and request data.
- `tests/` for folder-local executable checks.
- `docs/` for contracts, setup, state shapes, and limitations.
- `components/` and `hooks/` can be added by future UI issues.

## Review Contract

The core engine should remain verifiable without the main application:

- Request input is sanitized and validated before scoring.
- Article fixture shape is validated before ranking.
- Ranking is deterministic for the same request and article catalog.
- Loading, success, empty, and error state objects are documented and testable.
- The folder exports a small local API from `index.mjs` for future UI work.

## Out of Scope

- Main app routes, inbox wiring, dashboard layout, or design-system changes.
- Live search providers, LLM calls, network requests, secrets, or production data.
- Persistence, analytics, notification delivery, or authentication.
- Wallet, Stellar, payment, or database changes.
