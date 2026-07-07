# Knowledge Base Suggestion

Knowledge Base Suggestion is a V2 team tool for proposing internal help-center
or runbook articles from repeated email themes, support gaps, and team review
signals. This issue defines the isolated architecture contract only; it does not
wire the tool into the main app yet.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v2/team/knowledge-base-suggestion/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

## Architecture Map

- `specs.md` defines the release tier, contributor boundary, and required
  module categories.
- `docs/ARCHITECTURE.md` defines component, service, hook, test, and docs
  boundaries.
- `docs/DATA_OWNERSHIP.md` documents local data ownership, dependency rules,
  and future integration constraints.
- `tests/architecture-contract.test.mjs` validates that the architecture docs
  keep the required boundary language in place.

## Local Validation

Run from the repository root:

```bash
node --test tools/v2/team/knowledge-base-suggestion/tests/architecture-contract.test.mjs
```

The test is intentionally zero-dependency and does not import the main app.

## Current Limitations

- No inbox ingestion, support-ticket sync, knowledge base write, notification,
  database persistence, or approval workflow is implemented.
- No app shell, routing, dashboard, auth, wallet, Stellar, or shared
  design-system integration is included.
- Future feature work should build inside this folder first and leave app-level
  wiring to a separate integration issue.
