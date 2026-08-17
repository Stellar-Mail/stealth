# Performance Notes

## Access Check — O(1) Policy Lookup

`checkAccess(role, accessLevel, policy)` builds a `Set` from the allowed-levels array on each call. This keeps membership checks at O(1) regardless of how many levels a role holds. When implementation code caches the policy object across requests, the per-call cost is a single `Set` construction plus one `.has()` call.

## Team Size Guard

Scanning role membership across an entire team is O(n). Without a size cap, a team object with thousands of members can make access checks block the event loop for tens of milliseconds.

**Guard:** `guardTeamSize(members)` rejects arrays longer than **500 members** and throws `AccessValidationError` before any iteration starts. Implementation code must paginate team data and call access checks per page rather than loading all members at once.

```
Team size       Estimated scan time (no guard)
50 members      < 1 ms   ✓ safe
500 members     ~5 ms    ✓ at the limit
5 000 members   ~50 ms   ✗ blocks event loop
50 000 members  ~500 ms  ✗ effectively DoS
```

## Attachment Count Guard

Role-based attachment filtering (e.g., hiding attachments from `viewer` and `guest` roles) iterates over every attachment on a thread. Large threads with many attachments create the same O(n) risk.

**Guard:** `guardAttachmentCount(attachments)` rejects arrays longer than **100 attachments** and throws before filtering begins. Implementation code must paginate attachment lists.

## Field Length Limits

Short-circuit rejection of oversized strings prevents downstream code from performing expensive regex evaluation, database lookups, or string comparisons against adversarially long values.

| Field      | Limit     | Rationale                                               |
| ---------- | --------- | ------------------------------------------------------- |
| `role`     | 64 chars  | No real role name exceeds this; caps regex input length |
| `threadId` | 128 chars | Prevents lookup table abuse with artificially long keys |
| `email`    | 254 chars | RFC 5321 maximum; rejects padding attacks               |

## Allowlist Over Regex

Role and access-level validation uses `Set.has()` against a hard-coded allowlist rather than a regex pattern. This avoids ReDoS vulnerabilities from user-controlled strings matched against complex regular expressions.

## Future Performance Considerations

- **Policy caching** — if the policy object is fetched from a database, cache it per-request cycle rather than re-fetching per access check.
- **Bulk access checks** — if a UI needs to filter a list of threads for a given role, implement a single policy-aware filter pass rather than calling `checkAccess` once per thread in a loop.
- **Index by role** — when the policy grows to many roles, consider pre-indexing the policy as a `Map<role, Set<level>>` once at startup to eliminate repeated `Set` construction.
- **Large email bodies** — role-based redaction of email body content (e.g., hiding financial data from `viewer`) should operate on a streaming/chunked basis rather than loading full message bodies into memory.
