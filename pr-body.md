## Summary

This PR addresses issue #1537 by adding domain schema refinements to `src/server/api/domain.ts` to enforce receipt timestamp chronological ordering and future-time bounds.

Previously, `receiptSchema` validated ISO 8601 syntax for `deliveredAt` and `readAt`, but did not enforce:

1. That `readAt` follows `deliveredAt` (`readAt >= deliveredAt`).
2. That `deliveredAt` and `readAt` are plausible (not set too far into the future).

### Changes Implemented

- **`src/server/api/domain.ts`**:
  - Introduced `DEFAULT_RECEIPT_FUTURE_TOLERANCE_MS` (5 minutes tolerance for clock skew).
  - Introduced `ReceiptSchemaOptions` allowing configurable `maxFutureSkewMs` and reference clock `now` injection.
  - Implemented `createReceiptSchema(options)` using Zod `.superRefine(...)`:
    - Updated `deliveredAt` and `readAt` datetime validation to accept ISO 8601 strings with timezone offsets (`{ offset: true }`).
    - Enforced that `deliveredAt` must not exceed `now() + maxFutureSkewMs` (throws `"Delivery timestamp is too far in the future"`).
    - Enforced that when `readAt !== null`:
      - `readAt` must not precede `deliveredAt` (throws `"Read time cannot precede delivery time"`).
      - `readAt` must not exceed `now() + maxFutureSkewMs` (throws `"Read timestamp is too far in the future"`).
    - Kept `readAt: null` as valid without ordering/future checks.
  - Exported `receiptSchema = createReceiptSchema()`.

- **`tests/unit/api/domain.test.ts`**:
  - Added comprehensive test coverage for `receiptSchema` and `createReceiptSchema`:
    - Valid receipts with `readAt: null`.
    - Valid receipts with `readAt` equal to `deliveredAt` (exact boundary).
    - Valid receipts with `readAt` after `deliveredAt`.
    - Timezone-equivalent inputs (comparing UTC `Z` vs offset `+02:00`).
    - Rejection when `readAt` precedes `deliveredAt`.
    - Rejection when `deliveredAt` or `readAt` exceeds future clock tolerance.
    - Custom schema configuration with custom `now` and `maxFutureSkewMs`.

## Verification

- Unit tests executed and passed (`11 passed`):
  - `tests/unit/api/domain.test.ts`

Fixes #1537
