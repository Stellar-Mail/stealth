# Email Ownership Tracker Test Plan

## Scope

This tool is tested independently from the main application.

The current test validates the ownership fixture contract and ensures that the
expected ownership report remains internally consistent.

## Test Coverage

The fixture test verifies:

- Valid ownership actions
- Unique event identifiers
- Synthetic fixture data
- Ownership state transitions
- Handoff counting
- Ownership history references
- Supported anomaly codes
- Summary totals
- Owned and unassigned thread scenarios

## Execute

From the repository root:

```bash
node --test tools/v1/team/email-ownership-tracker/tests/ownership-fixtures.test.mjs
```
