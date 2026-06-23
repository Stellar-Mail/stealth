# Manager Review Queue Review Notes

## Scope

This folder is a self-contained mini-product workspace for manager approval
review. The current review target is the folder-local guard, fixture, and
documentation contract. No production integration is required.

## How To Review

1. Run the two Node test commands listed in `docs/test-plan.md`.
2. Confirm fixture data is synthetic and uses `.test` domains.
3. Confirm guard limits are documented before future contributors connect UI or
   service code to real data.
4. Confirm README and specs describe the local ownership boundary.

## Evidence Provided

- `tests/review-guards.test.mjs` exercises validation, sanitization, and
  performance guard behavior.
- `tests/documentation-contract.test.mjs` protects the contributor-facing review
  contract from drifting back to placeholder text.
- `fixtures/sample-review-requests.json` provides valid, hostile, and edge-case
  examples.
- `docs/test-plan.md` gives maintainers a short repeatable review checklist.

## Known Limitations

- The tests do not mount React components.
- The queue does not read from the main inbox or a database.
- The service layer uses local mock behavior only.
- Future integration must add adapter tests outside this issue.

## Safety Notes

- No secrets, payment data, production messages, or real manager approvals are
  included.
- No live network calls are required.
- Any future renderer must HTML-escape sanitized note and subject text before
  display.
