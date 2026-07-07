# Escalation Tool

Escalation Tool is an isolated V2 team workspace for identifying team email
threads that need handoff, manager review, or urgent follow-up. It is not wired
into the main app yet.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v2/team/escalation-tool/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

## Reviewer Setup

This issue adds folder-local documentation, synthetic fixtures, and a
zero-dependency Node contract test. Run from the repository root:

```bash
node --test tools/v2/team/escalation-tool/tests/escalation-docs.test.mjs
```

The test validates that the fixture and documentation describe an isolated,
reviewable escalation workflow.

## Documentation Map

- `specs.md` defines the tool scope, status model, and contributor boundary.
- `docs/test-plan.md` lists automated and manual review checks.
- `docs/review-notes.md` summarizes expected reviewer behavior and limitations.
- `fixtures/sample-escalation-cases.json` provides synthetic escalation examples.
- `tests/escalation-docs.test.mjs` validates the local fixture and documentation
  contract.

## Current Limitations

- No inbox ingestion or production mailbox access is included.
- No notifications, ticket writes, or manager assignment side effects are
  performed.
- Main app routing, dashboard placement, auth, wallet, Stellar, and database
  integration remain out of scope for this folder-local issue.
