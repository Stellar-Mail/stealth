# Security & Performance — Suspicious Sender Watchlist

This document defines the safety boundaries, threat assumptions, input sanitization rules, and performance constraints for the Suspicious Sender Watchlist tool.

---

## Trust Boundary

The guard module (`guards/watchlist-guards.mjs`) sits at the boundary between caller-supplied input and any downstream state mutation or data access. All inputs must be treated as untrusted until validated.

---

## Threat Assumptions

1. **Callers are untrusted.** Risk levels, statuses, email addresses, and free-text fields may arrive from arbitrary sources (UI forms, webhooks, CLIs) before future integration. Every field must be validated or sanitized before use.
2. **String inputs may be adversarially crafted.** Input may contain HTML tags (XSS), null bytes, control characters, or injection payloads.
3. **Email fields are a header-injection surface.** Any email address stored in the watchlist could later be placed into mail headers (e.g., for notifications). CRLF sequences must be stripped to prevent injection.
4. **Watchlist IDs are opaque identifiers.** They must not be treated as file paths or database keys. Path traversal sequences (`../`) and special characters must be rejected.
5. **Risk level and status are enum-like fields.** Allowlist validation must reject case variations, typos, or arbitrary values to prevent bypass.
6. **Large inputs are a denial-of-service surface.** Unbounded watchlist arrays, long free-text fields, and unconstrained search queries can degrade performance. Size caps must be enforced before iteration or storage.

---

## Hostile Input Categories

### Watchlist ID field

| Input                         | Attack vector                |
| ----------------------------- | ---------------------------- |
| `null` / `undefined` / `""`   | Null-check bypass            |
| `"../../../etc/passwd"`       | Path traversal               |
| `"watch-001\n"`               | Newline / injection in ID    |
| `"<script>alert(1)</script>"` | XSS payload in stored ID     |
| 65+ character string          | ID exhaustion / lookup abuse |

### Sender email field

| Input                                 | Attack vector                    |
| ------------------------------------- | -------------------------------- |
| `"user@evil.test\r\nBcc: victim@..."` | CRLF header injection            |
| `"user\0@evil.test"`                  | Null-byte injection              |
| `"@domain.test"`                      | Missing local part               |
| `"user@"`                             | Missing domain                   |
| `"notanemail"`                        | Missing `@` entirely             |
| 321+ character address                | RFC 5321 violation / buffer risk |

### Sender name field

| Input                         | Attack vector            |
| ----------------------------- | ------------------------ |
| `"<script>alert(1)</script>"` | XSS via stored name      |
| `"a\nb"`                      | Header injection in name |
| 201+ character string         | Memory / storage abuse   |

### Reason field

| Input                      | Attack vector                |
| -------------------------- | ---------------------------- |
| `"<img onerror=alert(1)>"` | XSS via stored reason        |
| 501+ character string      | Storage / rendering overhead |

### Notes field

| Input                    | Attack vector                |
| ------------------------ | ---------------------------- |
| `"<script>...</script>"` | XSS via stored notes         |
| 2001+ character string   | Storage / rendering overhead |

### Risk level field

| Input        | Attack vector                 |
| ------------ | ----------------------------- |
| `"HIGH"`     | Case-sensitivity bypass       |
| `"critical"` | Non-existent level escalation |
| `""`         | Empty-string bypass           |

### Entry status field

| Input       | Attack vector                 |
| ----------- | ----------------------------- |
| `"ACTIVE"`  | Case-sensitivity bypass       |
| `"deleted"` | Non-existent status injection |

### Search query field

| Input          | Attack vector                            |
| -------------- | ---------------------------------------- |
| 101+ character | ReDoS via long regex or string operation |

---

## Guard Layer

All validations are implemented inside the folder-local [`guards/watchlist-guards.mjs`](../guards/watchlist-guards.mjs).

### Sanitizers

- **`sanitizeText(raw)`**: Strips HTML tags (`/<[^>]*>/g`) and control characters (CR, LF, null bytes) from any input string. Applied to all free-text fields: sender name, reason, and notes. Returns `""` for non-string input.

### Per-field validators

| Function              | Enforces                                                                  |
| --------------------- | ------------------------------------------------------------------------- |
| `validateWatchlistId` | Non-empty, max 64 chars, only `[a-zA-Z0-9_-]` — prevents path traversal   |
| `validateSenderEmail` | Non-empty, max 320 chars (RFC 5321), rejects CR/LF/null, structural check |
| `validateSenderName`  | Non-empty, max 200 chars, sanitized                                       |
| `validateReason`      | Non-empty, max 500 chars, sanitized                                       |
| `validateNotes`       | Optional string, max 2000 chars, sanitized                                |
| `validateRiskLevel`   | Allowlist via `["low","medium","high"]` — case-insensitive                |
| `validateEntryStatus` | Allowlist via `["active","dismissed"]` — case-insensitive                 |
| `validateSearchQuery` | Max 100 chars, trimmed — prevents ReDoS                                   |

### Size guards

| Function             | Enforces                                                |
| -------------------- | ------------------------------------------------------- |
| `guardWatchlistSize` | Rejects arrays > **5,000 entries** before any iteration |

### Composite validator

- **`validateAddEntryInput(input)`**: Runs all per-field validators on an `AddEntryInput`-like object and returns a sanitized copy, or throws `WatchlistValidationError` on the first invalid field.

### Error type

All guard functions throw `WatchlistValidationError` (extends `Error`) with a `.field` property identifying which input field triggered the failure. This allows callers to map errors to specific form fields or log entries.

---

## Performance Notes

### Watchlist Size Guard

`getEntries()`, `getMetrics()`, and `applyFilter()` all iterate over the in-memory entries array — O(n) in the number of entries. Without a size cap, a watchlist with tens of thousands of entries can make filtering block the event loop.

**Guard:** `guardWatchlistSize(entries)` rejects arrays longer than **5,000 entries** and throws `WatchlistValidationError` before any iteration starts. Implementation code must paginate watchlist data rather than loading all entries at once.

```
Watchlist size    Estimated scan time (no guard)
100 entries       < 1 ms     ✓ safe
1 000 entries     ~2 ms      ✓ safe
5 000 entries     ~10 ms     ✓ at the limit
50 000 entries    ~100 ms    ✗ blocks event loop
500 000 entries   ~1 000 ms  ✗ effectively DoS
```

### Field Length Limits

Short-circuit rejection of oversized strings prevents downstream code from performing expensive in-memory operations, string comparisons, or regex evaluation against adversarially long values.

| Field         | Limit      | Rationale                                                      |
| ------------- | ---------- | -------------------------------------------------------------- |
| `id`          | 64 chars   | Caps lookup table abuse with artificially long keys            |
| `senderEmail` | 320 chars  | RFC 5321 maximum; rejects padding attacks                      |
| `senderName`  | 200 chars  | Real sender names never exceed this; caps memory per entry     |
| `reason`      | 500 chars  | Sufficient for threat descriptions; caps storage per entry     |
| `notes`       | 2 000 char | Ample for reviewer notes; caps storage per entry               |
| `search`      | 100 chars  | Prevents ReDoS and unnecessary iteration on long input strings |

### Allowlist Over Regex

Risk level and entry status validation uses `Array.includes()` against a hard-coded allowlist rather than a regex pattern. This avoids ReDoS vulnerabilities from user-controlled strings matched against complex regular expressions.

### Filter Complexity

The `applyFilter` function is O(n) in the number of entries (single pass with two optional array `filter()` calls + optional string `includes()` scan). The guard layer ensures n ≤ 5,000, so worst-case filtering remains under ~10 ms. If the watchlist integrates with a backend database in the future, filtering should be pushed to a database query with indexed columns.

### Future Performance Considerations

- **Database integration** — If the watchlist storage moves from in-memory to a database, push filtering to SQL queries with indexes on `riskLevel`, `status`, and a full-text index on `senderEmail`/`senderName`/`reason`.
- **Pagination** — UI integration should paginate results (e.g., 50 per page) rather than loading the full watchlist into the component.
- **Debounced search** — Search-as-you-type should debounce at 300 ms to avoid precomputing filters on every keystroke.
- **Lazy metrics** — `getMetrics()` recomputes aggregated counts from the full dataset. For large watchlists, consider caching metrics with staleness tolerance (e.g., recompute every 30 seconds).
- **Offline support** — If this tool is used in a browser extension context, consider IndexedDB for local watchlist storage to avoid parsing JSON blobs on every page load.

## Out-of-Scope Threats (follow-up issues)

- **Authentication** — Verifying that the caller is authorized to modify the watchlist requires session/token integration, which is not part of this isolated tool yet.
- **Rate limiting** — Preventing rapid adds/removals requires middleware outside this tool's boundary.
- **Encrypted IDs** — Protecting watchlist IDs from enumeration attacks requires a future architecture decision.
- **Audit logging** — Recording who added/removed entries for compliance is a separate concern.
- **Export sanitization** — If the watchlist is exported as CSV/JSON, output encoding must be handled at the export layer.
