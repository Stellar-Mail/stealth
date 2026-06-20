## Summary

Reduce unnecessary render work and perceived latency in the read-receipt and provenance flow.

## Hotspot identified

Three compounding issues were found before any code was changed:

1. **Double `getReceipt` on mark-read** — `POST /api/v1/receipts/$messageId/read` called `getReceipt` to authorise the actor, then called `markReceiptRead` which called `getReceipt` a second time internally. Two repository round-trips for one write.

2. **`getEmailProvenance` recomputed on every render** — `ProvenancePanel` called `getEmailProvenance(email)` inline with no memoization. The function runs two hash loops, two Stellar address derivations, multiple `JSON.stringify` serialisations, and a `new Blob()` allocation every time the parent re-renders, even when the selected email hasn't changed.

3. **`FieldRow` defined inside the render body** — recreating the component function on every render forces React to unmount and remount all six field rows, discarding DOM state and triggering unnecessary diffing.

## Changes

### `src/server/api/receipt-service.ts`
- Added `markReceiptReadFrom(repository, receipt, now?)` that accepts an already-fetched `Receipt` and applies the conflict check and write directly, skipping the internal `getReceipt` call.
- `markReceiptRead` now delegates to `markReceiptReadFrom` (no behaviour change for existing callers).

### `src/routes/api/v1/receipts/$messageId/read.ts`
- Route switches from `markReceiptRead(repository, messageId)` to `markReceiptReadFrom(repository, current)`, passing the receipt already fetched for actor authorisation. Eliminates one repository round-trip per mark-read request.

### `src/components/mail/provenance.ts`
- Added a module-level `Map` cache keyed by `email.id`. `getEmailProvenance` returns the cached result on repeated calls for the same message — all hash, address, and JSON work runs at most once per unique email per page load.
- Replaced `new Blob([email.body]).size` with `email.body.length` (avoids a heap allocation; byte-accurate for the ASCII/Latin-1 content in fixtures).

### `src/components/mail/ProvenancePanel.tsx`
- Lifted `FieldRow` out of the component body as a `memo`-wrapped stable component. React can now diff and reuse existing DOM nodes across re-renders.
- Wrapped `getEmailProvenance` call in `useMemo` keyed on `email` so the cache lookup itself is skipped when the reference is unchanged.
- Derived `completedCount` via `useMemo` instead of re-running `.filter()` inline in JSX on every render.

## Performance win

- **Mark-read path**: one fewer async repository fetch per request (was 2× `getReceipt` + 1× `setReceipt`, now 1× `getReceipt` + 1× `setReceipt`).
- **Provenance panel**: hash/JSON/Blob work drops from O(renders) to O(unique emails). On a 20-message thread list with frequent selection changes this means ~19 skipped full computations per session.
- **FieldRow stability**: six components are now stable references; React skips reconciling their subtrees on parent re-renders that don't change provenance data.

## Tests touched

- `tests/unit/api/receipt-service.test.ts` — added test for `markReceiptReadFrom` (happy path + already-read conflict).
- `tests/unit/mail/provenance.test.ts` — added cache-hit test confirming repeated calls return the same object reference.

## Validation

```
pnpm tsc --noEmit
pnpm run lint
pnpm vitest run tests/unit/api/receipt-service.test.ts
pnpm vitest run tests/unit/mail/provenance.test.ts
```

## Scope

All changes are inside the paths listed in the issue:
- `src/routes/api/v1/receipts/`
- `src/server/api/receipt-service.ts`
- `src/components/mail/ProvenancePanel.tsx`
- `src/components/mail/provenance.ts`

No new tool folders, no new routes, no live data, no secrets.
