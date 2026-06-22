# Knowledge Base Suggestion

The Knowledge Base Suggestion tool is an isolated V2 team workspace for proposing internal documentation updates from team context. It should help reviewers reason about suggested articles, stale docs, duplicates, missing runbooks, and blocked sensitive content without reading from or writing to the main mail app.

## Current Status

**Local review assets only - implementation deferred.** This folder contains contributor documentation, synthetic suggestion fixtures, and a fixture contract test. No app integration, mailbox ingestion, live knowledge base provider, or external index is implemented here.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v2/team/knowledge-base-suggestion/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

## Folder Structure

```text
- README.md
- specs.md
- fixtures/suggestion-scenarios.json
- tests/fixture-contract.test.mjs
- docs/TEST_PLAN.md
- docs/REVIEW_NOTES.md
```

See [specs.md](./specs.md) for contributor boundaries and expected modules.
See [docs/TEST_PLAN.md](./docs/TEST_PLAN.md) for setup, fixture usage, future coverage, and known limitations.
See [docs/REVIEW_NOTES.md](./docs/REVIEW_NOTES.md) for independent validation notes.

## Local Validation

Run the folder-local fixture contract test from the repository root:

```bash
node --test tools/v2/team/knowledge-base-suggestion/tests/fixture-contract.test.mjs
```

This validates synthetic suggestion scenarios only. It does not run app-wide tests, read real messages, publish docs, call a search index, or require secrets.
