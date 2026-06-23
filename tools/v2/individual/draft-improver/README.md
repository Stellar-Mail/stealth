# Draft Improver

This folder is the isolated workspace for the Draft Improver tool.

## Ownership Boundary

All work for this tool must stay inside:

`text
.\tools\v2\individual\draft-improver\
`

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

See specs.md for the issue categories and contributor expectations.

## Review Assets

- [docs/TEST_PLAN.md](docs/TEST_PLAN.md) explains the folder-local review flow, fixture checks, and future test coverage expected for the tool.
- [docs/REVIEW_NOTES.md](docs/REVIEW_NOTES.md) maps issue #488 acceptance criteria to the files in this folder.
- [fixtures/sample-drafts.json](fixtures/sample-drafts.json) contains deterministic draft-improvement examples for reviewers and future automated tests.
- [tests/draft-improver-fixtures.test.mjs](tests/draft-improver-fixtures.test.mjs) validates the fixture contract without app-wide dependencies.

Run the local fixture check from the repository root:

```bash
node --test tools/v2/individual/draft-improver/tests/draft-improver-fixtures.test.mjs
```
