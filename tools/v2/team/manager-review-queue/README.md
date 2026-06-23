# Manager Review Queue

Manager Review Queue is an isolated V2 team tool workspace for validating and
reviewing manager approval requests before any future mail-app integration.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v2/team/manager-review-queue/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet
core, Stellar core, database schema, or shared design system unless a future
integration issue explicitly allows it.

## Reviewer Setup

Run the folder-local tests from the repository root:

```bash
node tools/v2/team/manager-review-queue/tests/review-guards.test.mjs
node tools/v2/team/manager-review-queue/tests/documentation-contract.test.mjs
```

The first command validates security and performance guards against deterministic
fixtures. The second command checks that contributor-facing documentation and
fixture contracts stay reviewable.

## Documentation Map

- `docs/api.md` documents the local core-feature API contract.
- `docs/security-and-performance.md` documents guard behavior and limits.
- `docs/ACCESSIBILITY.md` documents keyboard and screen-reader expectations.
- `docs/VISUAL_STYLE.md` documents the local UI treatment.
- `docs/test-plan.md` lists automated and manual validation steps.
- `docs/review-notes.md` summarizes review scope and known limitations.

## Fixture Map

- `fixtures/sample-review-requests.json` contains valid requests, hostile input
  samples, and sanitizer edge cases.
- `tests/review-guards.test.mjs` consumes that fixture and validates guard
  behavior without network calls or production data.

## Known Limitations

- The tool is not mounted in the main app.
- Tests run against local fixtures and pure guards only.
- No network calls or production data are required.
- Main app routing, inbox data, persistence, authentication, wallet, and Stellar
  integration remain out of scope.
