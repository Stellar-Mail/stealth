# Test Plan - Manager Review Queue

This tool is isolated under `tools/v2/team/manager-review-queue/`. The current
test plan covers the folder-local guard layer, fixture contract, documentation
contract, and manual review steps for the local UI and mock review service.

## Automated Tests

Run from the repository root:

```
node --test tools/v2/team/manager-review-queue/tests/review-guards.test.mjs
node --test tools/v2/team/manager-review-queue/tests/documentation-contract.test.mjs
```

Run from this tool folder:

```
node --test tests/review-guards.test.mjs
node --test tests/documentation-contract.test.mjs
```

No install step is required for these tests. They use Node built-ins only.

## Guard Test Coverage

`tests/review-guards.test.mjs` validates:

1. `validateReviewId` accepts safe IDs and rejects empty strings, non-strings,
   path traversal, XSS payloads, SQL-like payloads, and oversized IDs.
2. `validateStatus` accepts only `pending`, `approved`, `rejected`, and
   `escalated`.
3. `validatePriority` accepts only `low`, `medium`, `high`, and `critical`.
4. `validateSubmitterEmail` blocks malformed addresses, CRLF injection, null
   bytes, empty strings, and oversized values.
5. `sanitizeNote` and `sanitizeSubject` remove unsafe control characters and cap
   length.
6. `validateReviewRequest` validates complete request objects.
7. `guardQueueSize`, `guardHistorySize`, `guardAttachmentCount`, and `guardTags`
   reject oversized or malformed collections before iteration.
8. `fixtures/sample-review-requests.json` drives valid request, hostile input,
   and sanitization edge-case checks.

## Documentation Contract Coverage

`tests/documentation-contract.test.mjs` validates:

1. README setup includes both executable test commands.
2. README explains fixtures, known limitations, and isolated ownership.
3. `specs.md` has no template placeholders and defines the V2 team scope.
4. `docs/test-plan.md` documents automated and manual review steps.
5. `docs/review-notes.md` tells reviewers what to inspect and what is out of
   scope.
6. Existing docs for API, accessibility, security/performance, and visual style
   remain discoverable from README.

## Manual Functional Review

When reviewing the local UI components in a test route or Storybook-like harness:

1. Render `ManagerReviewQueue`.
2. Confirm the initial loading state is visible while the mock service delay is
   pending.
3. Confirm pending queue items render after `fetchReviewQueue` resolves.
4. Approve, reject, or escalate an item and confirm it leaves the pending list.
5. Force `updateReviewItemStatus` to receive an unknown ID and confirm the error
   state appears with a retry path.
6. Filter the mock store so no pending items remain and confirm the empty state
   renders.
7. Confirm the success banner can be dismissed.

## Manual Accessibility Review

1. Tab through every queue item action button.
2. Confirm visible focus rings appear on action buttons and the active item.
3. Confirm screen reader output includes the page heading, item subjects, status,
   priority/risk context, and action labels.
4. Confirm loading, error, and success states are announced through live regions.
5. Confirm approve, reject, and escalate buttons have contextual accessible names.
6. Confirm no state depends on color alone.

## Manual Security and Performance Review

1. Review `guards/review-guards.mjs` before any service or UI integration.
2. Confirm field validators fail closed for unknown statuses and priorities.
3. Confirm free-text sanitizers do not claim to HTML-escape rendered output.
4. Confirm queue/history/attachment/tag guards run before iterating over large
   collections.
5. Confirm no production data, network call, wallet interaction, or database
   write is introduced by this folder.

## Known Limitations

- The mock service stores state in memory only.
- No app route mounts the UI yet.
- Authentication, authorization, durable audit logs, and notification delivery
  are future integration work.
- The guard tests do not compile the TypeScript UI; they cover the current
  zero-dependency guard layer and documentation contract.
- Renderers must still escape user-authored text before inserting it into HTML.
