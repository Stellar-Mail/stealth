# Security and Performance — Manager Review Queue

## Threat Model

### Assumptions

- Review requests originate from team members via the UI or a future API endpoint.
- No request origin can be fully trusted before validation — data may arrive from a browser, a webhook, or a CLI.
- This tool does not yet connect to the main app; guards are defensive preparation for that future integration.

### Attack Vectors and Mitigations

| Vector                                  | Example                                      | Mitigation                                                                                                |
| --------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Path traversal in IDs**               | `../../etc/passwd`                           | `validateReviewId` rejects anything that is not `[a-zA-Z0-9_-]+`                                          |
| **XSS via free-text fields**            | `<script>alert(1)</script>` in a review note | `sanitizeNote` / `sanitizeSubject` strip control characters; downstream renderers must HTML-escape output |
| **SQL injection in IDs**                | `review; DROP TABLE reviews--`               | ID allowlist regex rejects spaces and special characters                                                  |
| **CRLF / header injection via email**   | `user@evil.test\r\nBcc: victim`              | `validateSubmitterEmail` rejects any string containing `\r`, `\n`, or `\0`                                |
| **Null byte injection**                 | `user\0@evil.test`                           | Same control-character check in email validator                                                           |
| **Allowlist bypass via case variation** | `"PENDING"`, `"CRITICAL"`                    | Status and priority validators use an exact-match `Set` — case differences are rejected                   |
| **Oversized string DoS**                | 50 000-character reviewId sent to a lookup   | Each field has a length cap enforced before any further processing                                        |

### Design Choices

**Allowlist over regex** — `validateStatus` and `validatePriority` use `Set.has()` against a hard-coded list. This avoids ReDoS from user-controlled strings matched against complex patterns.

**Fail fast** — `validateReviewRequest` throws on the first invalid field rather than accumulating errors. For a manager approval queue the expected input rate is low, so a single-error-path keeps the implementation minimal and auditable.

**Sanitize, don't validate, free text** — Notes and subjects are user-authored free text; sanitization removes dangerous characters while preserving intent. The renderer is still responsible for HTML-escaping.

---

## Performance Notes

### Queue Processing — O(n) Guard

Scanning or sorting a review queue is O(n). Without a size cap, a queue with thousands of stale items can block the event loop during a single render cycle.

**Guard:** `guardQueueSize(items)` rejects arrays longer than **200 items** before iteration begins. Callers must paginate.

```
Queue size     Estimated scan time (no guard)
50 items       < 1 ms   ✓ safe
200 items      ~2 ms    ✓ at the limit
2 000 items    ~20 ms   ✗ noticeable lag
20 000 items   ~200 ms  ✗ blocks event loop
```

### Review History / Audit Trail — O(n) Guard

Audit trail scans (e.g. checking who approved a review) are O(n) over the history array.

**Guard:** `guardHistorySize(entries)` rejects arrays longer than **500 entries** before any scan. Long histories must be paginated server-side.

### Attachment Enumeration — O(n) Guard

Rendering attachment previews or checking attachment types during review iterates the full attachment list.

**Guard:** `guardAttachmentCount(attachments)` rejects arrays longer than **50 attachments** before iteration. Review items with more attachments must load them lazily or paginated.

### Tag Scanning — O(n) Guard

Tags are iterated during filtering and display.

**Guard:** `guardTags(tags)` rejects tag arrays longer than **20 tags** and individual tags longer than **64 characters** before any filter pass.

### Field Length Limits

Short-circuit rejection of oversized strings prevents expensive downstream processing.

| Field            | Limit       | Rationale                                               |
| ---------------- | ----------- | ------------------------------------------------------- |
| `reviewId`       | 128 chars   | Prevents lookup table abuse with artificially long keys |
| `submitterEmail` | 254 chars   | RFC 5321 maximum                                        |
| `note`           | 4 000 chars | Caps storage and render cost                            |
| `subject`        | 998 chars   | RFC 5322 line limit                                     |
| `tag`            | 64 chars    | No real tag exceeds this                                |

### Future Performance Considerations

- **Policy caching** — when approval policies are loaded from a database, cache per-request cycle rather than re-fetching per item.
- **Batch validation** — if validating a full page of queue items, consider a bulk validator that short-circuits after the first invalid item rather than re-checking structural invariants per item.
- **Large email bodies in review** — if review items include email body snippets, load them lazily (on expand) rather than eagerly for all items in the queue.
- **Indexing by status** — filtering by `"pending"` across a large dataset benefits from a server-side index. The client guard limit ensures the client never receives an unfiltered dump.
