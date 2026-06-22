# Knowledge Base Suggestion Specs

## Purpose

Help a team propose internal knowledge base updates from reviewable local context. The isolated tool should model suggestion quality, target article metadata, duplicate handling, sensitivity checks, and reviewer outcomes without publishing content or connecting to a live knowledge base.

## Contributor Boundary

All work for this tool must stay in:

```text
tools/v2/team/knowledge-base-suggestion/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, shared design system, mail rendering engine, or external document index unless a future integration issue explicitly allows it.

## Release Context

- Release tier: V2 Later
- Audience: Team
- Current status: Local fixtures, tests, and documentation only

## Expected Local Modules

- `components/`: planned suggestion list, article preview, evidence panel, reviewer actions, and sensitivity warnings.
- `services/`: planned suggestion scoring, duplicate detection, stale article checks, sensitivity guards, and audit note builders.
- `hooks/`: planned React state bridge between components and local services.
- `fixtures/`: synthetic suggestion requests and expected review outcomes.
- `tests/`: folder-local fixture, service, hook, and component tests.
- `docs/`: setup, test plan, review notes, limitations, and future integration notes.

## Review Outcomes

Future implementation should distinguish at least:

- `suggested`
- `needs_review`
- `duplicate`
- `rejected`
- `blocked`

Publishing remains out of scope. A suggestion outcome means the local review workflow classified the proposal, not that a production article changed.

## Required Issue Categories

- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation

## Review Contract

Tests and documentation should be reviewable without app-wide fixtures, real messages, production docs, external search indexes, live providers, secrets, or network calls.
