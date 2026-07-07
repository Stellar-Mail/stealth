# Review Notes - Manager Review Queue

This contribution makes the Manager Review Queue easier for OSS contributors to
review independently. It fixes the placeholder README/spec text, adds a focused
test plan, adds review notes, and adds a documentation contract test that keeps
the review instructions executable.

## What To Review

### Scope

- Every changed file should live under `tools/v2/team/manager-review-queue/`.
- There should be no changes to routing, dashboard layout, wallet code, Stellar
  integration, database schema, authentication, inbox architecture, root package
  files, or workflow files.
- The tool should remain reviewable without running the main app.

### Existing Guard Coverage

- `tests/review-guards.test.mjs` is the executable behavior suite for the current
  zero-dependency guard layer.
- It covers ID validation, status and priority allowlists, submitter email safety,
  text sanitization, request object validation, and collection size guards.
- It also exercises `fixtures/sample-review-requests.json` for valid requests,
  hostile inputs, and sanitization edge cases.

### New Documentation Coverage

- `docs/test-plan.md` should explain how to run automated checks and how to
  manually review UI, accessibility, security, and performance behavior.
- `docs/review-notes.md` should make this issue easy to validate without asking
  reviewers to inspect unrelated app code.
- `tests/documentation-contract.test.mjs` should fail if README/specs/docs lose
  the key setup, test command, known limitation, or isolation guidance.

### Fixtures

- `fixtures/reviewFixtures.ts` and `fixtures/sample-review-requests.json` should
  stay local and synthetic.
- Fixture data must not contain real users, production inbox data, credentials,
  wallet values, or external service tokens.

## Validation Commands

From the repository root:

```
node --test tools/v2/team/manager-review-queue/tests/review-guards.test.mjs
node --test tools/v2/team/manager-review-queue/tests/documentation-contract.test.mjs
git diff --check
```

## What Is Intentionally Not Included

- No app route, navigation link, dashboard integration, or inbox data connection.
- No persistence layer, database schema, authentication, or authorization policy.
- No wallet, Stellar, payment, or external API integration.
- No production data import or live manager approval workflow.
- No broad formatting pass over existing files.

## Follow-Up Shape

Future issues can add, inside this folder:

- Service tests for `fetchReviewQueue` and `updateReviewItemStatus` once a local
  TypeScript test runner is selected.
- Component tests for loading, empty, error, success, and populated queue states.
- Integration work that wires real inbox data and persistence, if explicitly
  approved by a future issue.
