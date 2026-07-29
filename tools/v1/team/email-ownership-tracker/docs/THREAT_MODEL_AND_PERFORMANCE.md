# Threat Model and Performance Analysis

Scope: the ownership engine in `services/email-ownership-tracker.service.ts`
(`trackOwnership` and `sortOwnershipEvents`). This complements the short
`SECURITY_AND_PERFORMANCE.md` with an explicit trust model, data classification,
and complexity analysis. It documents behavior only; it changes no code.

## 1. Scope and trust boundaries

- The engine is a pure, synchronous function: it takes an `OwnershipEvent[]` and
  returns an `OwnershipReport`.
- It performs no network, filesystem, environment, clock, or randomness access.
- It emits no logs; the caller owns all I/O, persistence, and telemetry.
- Trust boundary: the engine assumes actors are already authenticated and actions
  already authorized upstream. It performs **integrity** checks, not
  **authorization** checks.

## 2. Data classification

- `actor`, `owner`, and `previousOwner` are actor identifiers and may be email
  addresses, i.e. personal data.
- `note` is free-form and may carry sensitive content.
- The engine copies these values verbatim into `history` entries and `anomalies`.
  Treat `records`, `history`, and `anomalies` as containing PII and apply the same
  retention and redaction policy as the source inbox. Do not log full reports at
  info level.

## 3. Threats and mitigations

| Threat                            | Vector                                     | Engine behavior / mitigation                                                                            | Residual risk (caller action)                          |
| --------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Spoofed ownership                 | Forged `owner`/`actor` in an event         | Engine trusts input identifiers                                                                         | Authenticate and authorize before building events      |
| Silent state corruption           | Out-of-order or inconsistent events        | Emits `out-of-order-timestamp` and `owner-mismatch` anomalies instead of failing silently               | Surface and act on `report.anomalies`                  |
| Duplicate/replayed assignment     | Re-assigning the current owner             | Emits `duplicate-owner-assignment`; no phantom handoff counted                                          | Deduplicate upstream if replays are possible           |
| Reassign/release without owner    | Reassign or release on an unowned thread   | Emits `reassign-without-existing-owner` / `release-without-owner`                                       | Treat as integrity signal                              |
| Injection (SQL/HTML/log/template) | Malicious strings in identifiers or `note` | Engine does no interpolation, `eval`, regex, or template rendering; values are only compared and copied | Escape/parametrize at the render and persistence layer |
| PII leakage                       | Reports written to logs/telemetry          | Engine never logs                                                                                       | Redact identifiers and notes before logging            |

## 4. Denial-of-service and resource safety

- Time: `trackOwnership` is a single pass, O(n) in the number of events;
  `sortOwnershipEvents` is O(n log n).
- Memory: O(t + h), where t is the number of threads and h is the total history
  entries (h == n). `sortOwnershipEvents` allocates one shallow copy, O(n).
- No recursion, so large or deep inputs cannot cause a stack overflow.
- No regular expressions, so there is no ReDoS surface.
- Timestamp ordering uses `String.localeCompare` on caller-provided strings.
  Malformed timestamps do not throw; they sort lexicographically. This is a known
  limitation, not a crash vector.
- Recommended operational limit: keep batches at or below roughly 50k events per
  call. Beyond that, chunk by `threadId` to bound peak memory, because history is
  retained for every event.

## 5. Determinism and idempotency

- Output depends only on input contents and input order. Identical input yields
  identical output, so results are safe to cache or memoize.
- `sortOwnershipEvents` is non-mutating: it returns a new array and leaves the
  caller's array order untouched.
- `trackOwnership` does not mutate the input events.

## 6. Performance characteristics

| Operation             | Time       | Extra memory | Mutates input |
| --------------------- | ---------- | ------------ | ------------- |
| `trackOwnership`      | O(n)       | O(t + h)     | No            |
| `sortOwnershipEvents` | O(n log n) | O(n)         | No            |

## 7. Non-goals

- Authentication and authorization.
- Persistence, encryption at rest, and transport security.
- Timestamp format validation and timezone normalization.
- Rate limiting.

## 8. Recommended caller checklist

- [ ] Authenticate actors and authorize actions before building events.
- [ ] If source ordering is untrusted, sort with `sortOwnershipEvents` and review anomalies.
- [ ] Treat `report.anomalies` as actionable integrity signals, not ignorable warnings.
- [ ] Redact `owner`, `actor`, and `note` before logging reports.
- [ ] Chunk very large batches by thread to bound memory.
