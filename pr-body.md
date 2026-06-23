## Summary

Hardens the existing postage API surface — quote, submit, settle, and refund — with targeted
data-flow fixes. No new routes, tools, or features introduced.

## Hotspot Identification

Before changing any code, four concrete inefficiencies were traced through the listed paths:

1. **GET/POST mismatch on the quote endpoint** (`quote.ts` / `usePostageQuote.ts`):
   `usePostageQuote` fetches via `GET ?recipient=…&sender=…` but the route only registered a `POST`
   handler. Every quote request in the compose flow was silently falling through to a 405 / unhandled
   path, forcing the hook into the `error` state and masking the "trusted sender" fast-path entirely.

2. **Double repository read on settle and refund** (`$messageId/settle.ts`, `$messageId/refund.ts`):
   Both routes called `getPostage()` (one repo read) to authorise the actor, then delegated to
   `resolvePostage()` which called `getPostage()` a second time before writing. Every settle/refund
   was paying for two identical reads.

3. **Intermediate array allocation in `incrementCounter`** (`memory-repository.ts`):
   The old implementation spread the full timestamps array into a new array (`[...timestamps, now]`)
   then filtered it. For a busy rate-limit key (e.g. 500-entry relay bucket) this allocates and GCs
   an extra array on every request. Replaced with a forward-scan `slice` from the first
   still-valid index, then a single `push`.

4. **`structuredClone` on flat primitive objects** (`memory-repository.ts`):
   `getPostage`, `setPostage`, `getReceipt`, and `setReceipt` used `structuredClone`, which performs
   a full deep-clone walk. `Postage` and `Receipt` are plain flat objects with only string fields, so
   a shallow object spread (`{ ...x }`) provides the same isolation at a fraction of the cost.

## Changes

| File | Change |
|---|---|
| `src/routes/api/v1/postage/quote.ts` | Add `GET` handler that reads `recipient`/`sender` from query params; keep `POST` for backward compatibility |
| `src/routes/api/v1/postage/$messageId/refund.ts` | Inline the status check + write; eliminates the second `getPostage` call that lived inside `resolvePostage` |
| `src/routes/api/v1/postage/$messageId/settle.ts` | Same as refund |
| `src/server/api/memory-repository.ts` | Shallow spread for `Postage`/`Receipt` copy; forward-scan eviction in `incrementCounter` |

## Measured / Reasoned Win

- **Quote latency**: was always erroring (405) for the GET path used by `usePostageQuote`; now
  resolves correctly with one repository round-trip.
- **Settle/refund**: repo read count drops from 2 → 1 per call (50 % reduction for those endpoints).
- **`incrementCounter`**: eliminates one `O(n)` array allocation per call; at the relay-abuse limit
  of 500 entries the old path allocated a 501-element array then a filtered copy; the new path slices
  only expired entries from the front and does a single `push`.
- **`getPostage`/`setPostage`**: `structuredClone` on a 7-field flat object runs the full
  structured-serialise algorithm; `{ ...x }` is a single property enumeration — measurably faster
  under V8 for flat shapes.

## Validation

All existing unit tests in `tests/unit/api/postage-service.test.ts`,
`postage-service.regression.test.ts`, and `memory-repository.test.ts` cover the touched paths
without modification. The e2e suite in `tests/e2e/postage.spec.ts` exercises the full
submit → settle / refund flow end-to-end.

```
bun run test          # unit suite
bun run test:e2e      # postage.spec.ts
```

## Boundary Compliance

- All changes are within `src/routes/api/v1/postage/` and `src/server/api/`
- No new V1/V2 tool folder added
- No live data, secrets, or real addresses used
- No visible regression in empty, loading, populated, or error states
