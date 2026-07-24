# Test Plan

## Automated Fixture Test

Run from the repository root:

```bash
node --test tools/v2/individual/unsubscribe-finder/tests/unsubscribe-fixtures.test.mjs
node --experimental-strip-types --test tools/v2/individual/unsubscribe-finder/tests/unsubscribe-service.test.ts
```

Expected result:

- the sample fixture parses as JSON
- each source message maps to one expected candidate
- all local unsubscribe statuses are represented
- confidence scores stay between 0 and 1
- unsafe and ignored candidates are not offered as actions
- body-link-only candidates require review
- the exported service returns structured success output for valid input
- the exported service returns stable error codes for empty and malformed input

## Manual Review Checklist

1. Open `fixtures/sample-unsubscribe-candidates.json`.
2. Confirm all source messages use synthetic data.
3. Confirm each expected candidate has a traceable `sourceMessageId`.
4. Confirm `docs/review-notes.md` documents out-of-scope live unsubscribe
   execution.
5. Confirm the failure fixtures exercise empty input and malformed message input.
6. Confirm no files outside `tools/v2/individual/unsubscribe-finder/` changed.

## Edge Cases Covered

- high-confidence `List-Unsubscribe` header
- body-only unsubscribe link requiring review
- suspicious unsubscribe target marked unsafe
- transactional message ignored

## Future Integration Tests

When implementation code is added, add tests for:

- URL allowlist and denylist handling
- same-domain and cross-domain unsubscribe targets
- one-click unsubscribe consent prompts
- duplicate sender grouping
- rollback or audit behavior after a user action
- live inbox routing or mailbox mutation behavior
