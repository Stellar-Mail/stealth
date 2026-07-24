# Test Plan

This folder keeps its own validation plan so contributors can review it without touching the main app.

## Automated Checks

Run these commands from the repository root:

```bash
node --test tools/v2/team/role-based-mail-access/tests/access-guards.test.mjs
npx vitest -c tools/v2/team/role-based-mail-access/vitest.config.ts run
```

### Expected Guard Coverage

- `sanitizeRole` removes whitespace and unsafe punctuation.
- `validateRole`, `validateAccessLevel`, `validateEmailAddress`, and `validateThreadId` reject malformed or hostile input.
- `validateAccessRequest` validates the whole request payload.
- `checkAccess` grants and denies against the local policy map.
- `guardTeamSize` and `guardAttachmentCount` enforce the local size ceilings.

### Expected Service Coverage

- The service starts with the default policy and an empty audit log.
- Policy updates only accept recognized roles and access levels.
- Access checks append audit entries in newest-first order.
- Invalid requests are rejected with field-level errors.
- Boundary checks fail above the limit and pass at the exact threshold.

## Manual Review Checklist

1. Open [../fixtures/sample-access-requests.json](../fixtures/sample-access-requests.json).
2. Confirm the fixture contains 5 valid requests, 19 hostile inputs, and documented boundary values.
3. Read [../docs/review-notes.md](../docs/review-notes.md) for the expected review flow.
4. Confirm every file changed by the issue lives inside `tools/v2/team/role-based-mail-access/`.
5. Verify the tool is still isolated from main-app routing, inbox rendering, wallet code, and database work.

## Known Gaps

- There are no integration tests against the main application.
- The demo UI is local-only and does not mount into app-wide navigation.
- Persistence is intentionally out of scope for this release tier.
