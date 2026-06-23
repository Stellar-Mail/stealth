# Manager Review Queue Test Plan

## Automated Checks

Run from the repository root:

```bash
node tools/v2/team/manager-review-queue/tests/review-guards.test.mjs
node tools/v2/team/manager-review-queue/tests/documentation-contract.test.mjs
```

`review-guards.test.mjs` verifies:

- valid request ids, statuses, priorities, and submitter emails
- rejection of path traversal, XSS-like ids, SQL-like ids, CRLF injection, null
  bytes, unknown statuses, and unknown priorities
- note and subject sanitization
- queue, history, attachment, and tag guard limits
- deterministic fixture coverage for valid requests, hostile inputs, and edge
  cases

`documentation-contract.test.mjs` verifies:

- README setup commands remain present
- specs do not regress to generated template placeholders
- fixtures include required review scenarios
- review docs cover independent setup, limitations, and safety boundaries

## Manual Review Checklist

- Confirm all changed files are under `tools/v2/team/manager-review-queue/`.
- Confirm no main app route, inbox, wallet, Stellar, auth, or database file is
  modified.
- Read `docs/security-and-performance.md` and confirm limits match the exported
  `LIMITS` object in `guards/review-guards.mjs`.
- Inspect `fixtures/sample-review-requests.json` and confirm every email address
  uses `.test` domains.
- Confirm docs describe empty, loading, error, and success review states without
  requiring app integration.

## Out Of Scope

- Main app integration.
- Live network calls.
- Production data, real customer emails, or real manager approvals.
- Persistent storage and database schema changes.
