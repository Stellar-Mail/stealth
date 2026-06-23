# Escalation Tool

Escalation Tool is an isolated V2 team workspace for defining how mail or
workflow conversations should be escalated to the right reviewer, team, or
severity queue.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v2/team/escalation-tool/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet
core, Stellar core, database schema, or shared design system unless a future
integration issue explicitly allows it.

## Current Status

This contribution adds testing and documentation scaffolding for future
implementation. It does not add live routing, mailbox access, notification
delivery, or persistence.

## Reviewer Setup

Run the folder-local contract test from the repository root:

```bash
node tools/v2/team/escalation-tool/tests/documentation-contract.test.mjs
```

The test validates fixture shape, documentation coverage, and isolation
boundaries for this tool.

## Documentation Map

- `fixtures/sample-escalations.json` contains deterministic escalation examples.
- `docs/test-plan.md` lists automated and manual review steps.
- `docs/review-notes.md` documents current scope and known limitations.
- `tests/documentation-contract.test.mjs` protects the contributor-facing
  documentation contract.

## Known Limitations

- No escalation engine is implemented yet.
- No live notifications, mail data, team directory, or SLA service is connected.
- Future implementation should add pure services and tests in this folder before
  any main app integration.
