# Team Payment Approval — Performance Notes

This document records performance characteristics, known bottlenecks, and
recommended usage patterns for the Team Payment Approval tool. It is intended
for future contributors and for the team that will eventually integrate this
tool into the main app.

## Current Performance Profile

### Execution Service (single decision)

| Operation                      | Complexity | Notes                                            |
| ------------------------------ | ---------- | ------------------------------------------------ |
| `validatePaymentApprovalInput` | O(1)       | Structural checks on a fixed set of fields.      |
| `checkInputLimits`             | O(1)       | Length comparisons on fixed fields.              |
| `sanitizeInput`                | O(n)       | NFC normalization + regex replace on each field. |
| `store.getPayment`             | O(1)       | Map lookup by id.                                |
| `store.getDecisions`           | O(1)       | Map lookup by id.                                |
| `store.recordDecision`         | O(1)       | Map set + array push.                            |
| **Total per decision**         | **O(n)**   | n = total length of input strings.               |

The execution path is already efficient for single decisions. The guard layer
adds negligible overhead (string length checks and regex replaces on small
strings).

### Payment Service (in-memory store)

| Operation            | Complexity     | Notes                                        |
| -------------------- | -------------- | -------------------------------------------- |
| `addPayment`         | O(1)           | Map.set.                                     |
| `getPayment`         | O(1)           | Map.get.                                     |
| `getAllPayments`     | O(p)           | `Array.from(map.values())` — allocates a new |
|                      |                | array every call.                            |
| `getPendingPayments` | O(p)           | Full scan + filter.                          |
| `recordDecision`     | O(1) amortized | Array push. Amortized O(n) if list is not    |
|                      |                | pre-allocated.                               |
| `getDecisions`       | O(1)           | Map.get.                                     |

p = number of payments in the store.

### Decision Service (localStorage-backed)

| Operation         | Complexity | Notes                                           |
| ----------------- | ---------- | ----------------------------------------------- |
| `recordDecision`  | O(d)       | Writes entire decisions map to localStorage via |
|                   |            | `JSON.stringify`. d = number of decisions.      |
| `getAllDecisions` | O(d)       | `Array.from(map.values())`.                     |
| `loadFromStorage` | O(d)       | `JSON.parse` + forEach.                         |

**Key bottleneck:** Every `recordDecision` call when `useStorage = true`
serializes the _entire_ decisions map to localStorage. This is O(d) per write
where d is the total number of decisions.

## Known Performance Risks

### 1. Unbounded `getAllPayments()` / `getAllDecisions()`

Both `PaymentService` and `DecisionService` convert their internal Maps to
arrays on every call. For large datasets (thousands of entries), this creates
significant GC pressure and can cause frame drops in a browser context.

**Mitigation:** Use `getPendingPayments()` or filter by status/priority instead
of `getAllPayments()` when possible. For future integration, consider adding
pagination or cursor-based iteration.

### 2. localStorage Serialization Cost

The `DecisionService` with `useStorage = true` serializes the entire decisions
map on every write. With 10,000 decisions, each write serializes ~10,000
objects.

**Mitigation:** Use `decisionService` (in-memory only) for the hot path. Use
`persistentDecisionService` only for persistence-critical operations. Consider
batching writes in the future.

### 3. Full-Table Filter Operations

`getPendingPayments()` and `getDecisions()` perform full scans. With large
datasets, these become O(n) on every call.

**Mitigation:** For large datasets, maintain secondary indices (e.g., a
`pendingPayments` Set) rather than filtering on every access. This is a
follow-up optimization for when the tool handles >1,000 payments.

### 4. String Sanitization on Large Notes

`sanitizeText()` performs NFC normalization and two regex replaces. For very
large strings (megabytes), this is O(n) but can be slow due to regex engine
overhead.

**Mitigation:** The guard layer enforces a 10,000-character limit on notes
via `GUARD_LIMITS.maxNotesChars`. This caps the sanitization cost per field.

## Recommended Usage Patterns

### For Small Teams (< 100 payments)

No optimization needed. The current in-memory store is fast enough for
interactive use. All operations complete in < 1ms.

### For Medium Teams (100–1,000 payments)

- Use `getPendingPayments()` instead of `getAllPayments().filter(...)`.
- Avoid `persistentDecisionService` in hot loops; batch persistence manually.
- Consider virtualizing the payment list in the UI (React Virtual, etc.).

### For Large Teams (1,000+ payments)

This tool's current architecture is not designed for this scale. When
integrating into the main app:

1. **Replace the in-memory store** with a server-backed store implementing
   `PaymentApprovalStore`.
2. **Add pagination** to list operations. The `batchSizeGuard()` and
   `trimCollection()` helpers in `guards.ts` support this.
3. **Use cursor-based iteration** for decision history instead of
   `getAllDecisions()`.
4. **Debounce localStorage writes** if using the persistent decision service.

## Guard-Layer Performance

The guard functions are designed to be O(1) or O(n) on input string length:

| Guard Function                 | Complexity | Notes                                 |
| ------------------------------ | ---------- | ------------------------------------- |
| `validatePaymentApprovalInput` | O(1)       | typeof checks + string length.        |
| `checkInputLimits`             | O(1)       | `.length` on fixed fields.            |
| `sanitizeText`                 | O(n)       | NFC + 2 regex passes. n = string len. |
| `sanitizeInput`                | O(n)       | sanitizeText on each field.           |
| `isPrototypeSafe`              | O(k)       | k = number of keys in the object.     |
| `normalizeDate`                | O(1)       | Single Date parse.                    |
| `batchSizeGuard`               | O(1)       | Single number check.                  |

The guard layer should never be the bottleneck. If performance issues arise,
they are in the store operations or UI rendering, not in validation.

## Memory Considerations

| Object                 | Per-Entry Estimate | Notes                               |
| ---------------------- | ------------------ | ----------------------------------- |
| `PaymentRequest`       | ~500 bytes         | Fields + Date objects.              |
| `ApprovalDecision`     | ~300 bytes         | Fields + Date object.               |
| `ApprovalWorkflow`     | ~800 bytes         | Includes approval/rejection arrays. |
| In-memory Map overhead | ~100 bytes/entry   | V8 Map overhead.                    |

For 10,000 payments with 2 decisions each:

- ~10 MB total memory usage.
- Acceptable for browser context.

For 100,000+ payments, consider server-side storage.

## Stress Test Recommendations

Before integrating into the main app, validate:

1. **10,000 payments loaded** — verify no frame drops on initial render.
2. **1,000 rapid-fire decisions** — verify no memory leaks in DecisionService.
3. **localStorage at 5MB** — verify graceful handling of quota exceeded.
4. **Notes field at 10,000 chars** — verify sanitization completes in < 10ms.
5. **Prototype pollution attempt** — verify guard rejects `__proto__` keys.

## Future Optimization Opportunities

1. **Indexed store:** Maintain secondary indices for status/priority filters.
2. **Lazy evaluation:** Only materialize arrays when accessed.
3. **Worker offloading:** Move sanitization of large text to a Web Worker.
4. **Incremental localStorage:** Write only changed decisions, not the full map.
5. **Virtual scrolling:** Use React Virtual or similar for large lists.
