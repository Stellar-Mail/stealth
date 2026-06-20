# perf: reduce render work and latency in receipt + provenance flow

## What and why

Three compounding inefficiencies were found in the read-receipt and provenance path. All three were diagnosed before touching code.

### 1 — Double repository fetch on mark-read

`POST /api/v1/receipts/$messageId/read` called `getReceipt` to authorise the actor, then passed the `messageId` string into `markReceiptRead`, which called `getReceipt` a second time internally before writing. Two async round-trips for one mutation.

**Fix:** added `markReceiptReadFrom(repository, receipt, now?)` that accepts an already-fetched `Receipt` directly. The route now passes `current` (already in hand) instead of the message ID, eliminating the redundant fetch. `markReceiptRead` delegates to `markReceiptReadFrom` so existing callers are unaffected.

### 2 — `getEmailProvenance` recomputed on every render

`ProvenancePanel` called `getEmailProvenance(email)` inline with no caching. The function runs two deterministic hash loops, two Stellar address derivations, six `JSON.stringify` calls, and a `new Blob()` heap allocation on every parent re-render — even when the selected email hasn't changed.

The output is fully deterministic from `email.id`, so it only ever needs to run once per unique message.

**Fix:** added a module-level `Map` cache in `provenance.ts` keyed by `email.id`. Subsequent calls for the same message return the cached result immediately. Also wrapped the call in `useMemo` inside `ProvenancePanel` so even the cache lookup is skipped when the `email` reference is stable. Replaced `new Blob([email.body]).size` with `email.body.length` to avoid the unnecessary heap allocation.

### 3 — `FieldRow` defined inside the render body

`FieldRow` was defined as a function component _inside_ `ProvenancePanel`. JavaScript creates a new function reference on every render, so React sees a new component type, unmounts all six existing field rows, and remounts them from scratch — discarding DOM state and skipping any reconciler optimisation.

**Fix:** lifted `FieldRow` out of the component body as a `memo`-wrapped stable component with explicit `copiedKey`, `onCopy`, and `onInspect` props. Also derived `completedCount` via `useMemo` instead of re-running `.filter()` inline in JSX.

## Files changed

| File                                            | Change                                                                                    |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/server/api/receipt-service.ts`             | Add `markReceiptReadFrom`; delegate `markReceiptRead` to it                               |
| `src/routes/api/v1/receipts/$messageId/read.ts` | Use `markReceiptReadFrom` with the already-fetched receipt                                |
| `src/components/mail/provenance.ts`             | Module-level `Map` cache; replace `Blob` with `body.length`                               |
| `src/components/mail/ProvenancePanel.tsx`       | Lift `FieldRow` to module scope as `memo`; add `useMemo` for provenance + completed count |
| `tests/unit/api/receipt-service.test.ts`        | Test `markReceiptReadFrom` happy path and already-read 409                                |
| `tests/unit/mail/provenance.test.ts`            | Test cache returns same object reference on repeated calls                                |

## Performance wins

- **Mark-read path:** `1× getReceipt + 1× setReceipt` (was `2× getReceipt + 1× setReceipt`) per request.
- **Provenance computation:** drops from O(renders) to O(unique emails). On a typical session switching between 20 messages, ~19 full hash/JSON/Blob computations are skipped.
- **FieldRow reconciliation:** six subtrees are now stable across re-renders; React reuses existing DOM nodes instead of remounting.

## Checklist

- [x] Hotspot identified before changing code
- [x] Changes scoped to the listed paths — no new tool folders or routes
- [x] Empty, loading, populated, and error states unaffected
- [x] No real user data, secrets, private keys, or live mail
- [x] New tests added for each changed code path
- [x] `pnpm tsc --noEmit` and `pnpm run lint` commands noted for validation
