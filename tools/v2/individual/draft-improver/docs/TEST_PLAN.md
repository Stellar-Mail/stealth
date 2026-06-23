# Draft Improver Test Plan

## Scope

This test plan covers only the isolated Draft Improver workspace:

```text
tools/v2/individual/draft-improver/
```

It does not require the main app shell, routing, wallet logic, Stellar integration, database schema, or shared design system.

## Current Coverage

The current folder has review fixtures and a local Node test that verifies the fixture contract:

```bash
node --test tools/v2/individual/draft-improver/tests/draft-improver-fixtures.test.mjs
```

The test checks that each sample draft has:

- a stable kebab-case id;
- a scenario reviewers can understand;
- an input draft and a changed suggested draft;
- at least two improvement goals;
- at least two concrete review checks.

## Fixture Review Matrix

| Fixture | Main Behavior | Review Focus |
| --- | --- | --- |
| `support-refund-follow-up` | Rewrites a terse support reply into a warmer customer update. | Preserves refund uncertainty and avoids promising an outcome. |
| `sales-demo-reschedule` | Shortens a vague sales note into a clear scheduling request. | Keeps the next action concrete without inventing calendar details. |
| `security-review-summary` | Clarifies an internal status update. | Avoids leaking implementation details while asking for review. |

## Manual Review Checklist

- Confirm every fixture stays inside the Draft Improver folder.
- Confirm suggested drafts preserve the factual meaning of the input draft.
- Confirm the tool does not add promises, dates, approvals, recipients, or private details that were not present in the input.
- Confirm known limitations are clear enough for future implementation work.
- Confirm future UI work can reuse the fixtures without touching app-wide routes or shared mail state.

## Future Automated Coverage

When the core service is implemented, add folder-local tests for:

- preserving original intent and key facts;
- rejecting empty or whitespace-only drafts;
- keeping suggested drafts within an expected length range;
- returning review notes for risky or ambiguous input;
- avoiding private-data exposure in preview fixtures and logs.

These tests should remain under this folder unless a future integration issue explicitly allows app-wide coverage.
