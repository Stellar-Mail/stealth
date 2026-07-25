# Testing

The Manager Review Queue tool has two complementary test suites, both scoped to
this folder and free of UI, network, or database dependencies.

## Suites

- `tests/contract.test.ts` and `tests/contract-coverage.test.ts` — Vitest suites
  for the non-UI execution contract (`createReviewQueueContract`,
  `applyReviewOperation`, and the input validators). Together they cover fetch
  filtering and pagination, status transitions, store persistence, and every
  `ReviewErrorCode` path.
- `tests/review-guards.test.mjs` — Node's built-in test runner suite for the
  input guards and sanitizers in `guards/review-guards.mjs`.

## Running

Vitest suites, from the repository root, using this tool's local config:

    npx vitest run --config tools/v2/team/manager-review-queue/vitest.config.ts

Guard suite (no dependencies required):

    node --test tools/v2/team/manager-review-queue/tests/review-guards.test.mjs

## Contract coverage matrix

| Area         | Case                             | Expected                             |
| :----------- | :------------------------------- | :----------------------------------- |
| fetch        | no filters or paging             | all items, full totalCount           |
| fetch        | offset + limit                   | correct slice, full totalCount       |
| fetch        | minRiskScore filter              | only items at or above the threshold |
| fetch        | status filter                    | only that status                     |
| fetch        | negative or NaN limit            | INVALID_INPUT                        |
| fetch        | limit above MAX_QUEUE_SIZE       | INVALID_INPUT                        |
| fetch        | negative offset                  | INVALID_INPUT                        |
| updateStatus | pending to approved or escalated | success                              |
| updateStatus | escalated to approved            | success                              |
| updateStatus | change persists on next fetch    | success                              |
| updateStatus | empty or whitespace itemId       | INVALID_INPUT                        |
| updateStatus | unknown target status            | INVALID_INPUT                        |
| updateStatus | unknown itemId                   | ITEM_NOT_FOUND                       |
| updateStatus | terminal source status           | INVALID_TRANSITION                   |
| operation    | unrecognised operation           | INVALID_INPUT                        |

## Notes

All fixtures are synthetic and deterministic. The contract runs with its
simulated network delay disabled in tests for speed and repeatability.
