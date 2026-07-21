# Reviewer Validation Notes

This guide is for OSS contributors validating the isolated Role-Based Mail Access tool.

## Fast Checks

- Run [../tests/test-plan.md](../tests/test-plan.md) from top to bottom.
- Confirm `node --test tools/v2/team/role-based-mail-access/tests/access-guards.test.mjs` passes.
- Confirm `npx vitest -c tools/v2/team/role-based-mail-access/vitest.config.ts run` passes when dependencies are installed.
- Check that no file outside `tools/v2/team/role-based-mail-access/` changed for this issue.

## What To Review

1. The guard suite should reject every hostile payload in `fixtures/sample-access-requests.json`.
2. The service tests should show that policies, logs, and size limits behave independently of the main app.
3. The docs should explain setup, usage, fixture scope, and known limitations without referencing the main app shell.
4. The folder should remain easy to remove or refactor later because nothing is wired into app-wide routing or state.

## Expected Results

- The Node guard suite covers sanitization, validation, limits, and fixture contract checks.
- The Vitest suite covers core service behavior, log order, policy updates, and isolation boundaries.
- The fixture file remains local and readable.
- The tool stays a self-contained mini-product until a future integration issue is approved.
