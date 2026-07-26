# Team Security Flagging — Performance Constraints

## Overview

This document describes the performance characteristics of the current
implementation and the constraints callers should observe when operating at
scale. The tool is designed as a pure-function core — all performance
guarantees follow from the absence of I/O, network, or persistent state.

---

## Classification Performance (`classifyEmail`)

### Current characteristics

`classifyEmail` concatenates `subject`, `snippet`, `bodyPreview`, and
`senderEmail` into a single lowercase string, then scans it against the
keyword signal map (six categories, ~50 total signals). Each scan is a
`String.prototype.includes()` call — O(n) per signal, O(n × m) total where
`n` is input length and `m` is signal count.

**Worst case:** A 100 KB bodyPreview forces lowercasing and ~50 substring
scans over the full text even though threat signals typically appear in
the first 500 characters.

### Guidance for callers

- Truncate `bodyPreview` to **4000 characters** before calling
  `classifyEmail()`. The first few thousand characters contain subject,
  greeting, and call-to-action — the signals used for classification.
- Truncate `snippet` to **500 characters** (most email clients already
  limit snippets to ~200 characters).
- Do **not** pass full raw email bodies. The function is designed for
  email metadata, not MIME-parsed content.

### In-practice performance

| Input size | Approximate time (Node 20) | Notes |
|---|---|---|
| 500 chars (typical) | < 0.1 ms | Subject + snippet only |
| 4000 chars (truncated) | < 0.5 ms | Recommended max |
| 100 KB (untruncated) | ~3–8 ms | Avoid — linear slowdown |
| 1 MB (untruncated) | ~30–80 ms | Do not pass raw bodies |

---

## Validation Performance

### Per-field cost

All validators are O(1) or O(n) on field length:

| Validator | Complexity | Typical time |
|---|---|---|
| `sanitizeText` | O(n) | < 0.01 ms for 1000 chars |
| `validateSeverity` | O(1) | < 0.001 ms |
| `validateCategory` | O(1) | < 0.001 ms |
| `validateStatus` | O(1) | < 0.001 ms |
| `validateEmail` | O(n) + regex | < 0.01 ms for 254 chars |
| `validateThreadId` | O(n) + regex | < 0.005 ms for 100 chars |
| `validateEmailId` | O(n) + regex | < 0.005 ms for 100 chars |
| `validateDescription` | O(n) | < 0.01 ms for 2000 chars |
| `validateEvidence` | O(n × m) | < 0.05 ms for 10 items × 500 chars |
| `validateCreateFlagInput` | Sum of above | < 0.1 ms for typical input |

### Composite cost

`validateAndNormalize` (called in the execution service) runs all validators
sequentially. For a well-formed input at maximum allowed sizes:

- Description: 2000 chars
- Evidence: 10 items × 500 chars
- All other fields at maximum allowed length

Expected wall time: **< 0.3 ms**.

---

## Execution Service Performance

### `executeSecurityFlagging`

The execution service adds three caller-supplied async boundaries on top
of validation:

1. `authorizeReporter(email)` — latency depends on auth backend
2. `findActiveFlag({ emailId, threadId })` — latency depends on storage
3. `persistFlag(record)` — latency depends on storage

The pure validation portion is **< 0.3 ms**. The total wall time is
dominated by the caller-supplied dependencies.

### Guard overhead

`guardSecurityFlaggingInput` (in `guards/security-guards.mjs`) performs a
lightweight pre-check before the full validation pipeline:

- `JSON.stringify` serialization of input (fast path for small objects)
- String length comparison against `MAX_BODY_BYTES` (64 KB)

Expected cost: **< 0.02 ms** for typical inputs.

---

## Large Email Handling

### What the tool does NOT do

- Does **not** parse MIME bodies, decode attachments, or follow links
- Does **not** fetch sender reputation or DNS records
- Does **not** store or cache email content between calls
- Does **not** batch or throttle concurrent calls (that is the caller's
  responsibility)

### What callers should do at scale

- **Truncate before calling**: Pass only the email metadata, not the full
  body. 4000 characters of bodyPreview is sufficient for classification.
- **Rate-limit submissions**: The guard module's `MAX_CALLS_PER_WINDOW`
  constant documents the intended rate ceiling. A production integration
  should enforce per-team or per-user rate limits at the API boundary.
- **Pre-validate payload size**: The `guardSecurityFlaggingInput` function
  rejects payloads over 64 KB before any classification or validation
  work begins. Callers may enforce a smaller limit at the edge.
- **Use early exit**: If an email has no subject, no body, or is from a
  known-safe sender domain, skip classification entirely.

---

## Batch Classification

The tool does not currently expose a batch classification function. For
processing multiple emails sequentially:

```js
const results = emails.map((email) => classifyEmail({
  subject: email.subject.slice(0, 500),
  snippet: email.snippet.slice(0, 500),
  bodyPreview: email.bodyPreview.slice(0, 4000),
  senderEmail: email.senderEmail,
}));
```

**Batch of 1000 truncated emails:** ~100–500 ms total classification time.
Memory: O(1) per call — no intermediate aggregation.

---

## Guard Constants Reference

```js
// From guards/security-guards.mjs
MAX_BODY_BYTES: 65536,        // 64 KB max serialized payload
MAX_EVIDENCE_ITEMS: 10,       // Already enforced in validators
MAX_EVIDENCE_LENGTH: 500,     // Already enforced in validators
MAX_DESCRIPTION_LENGTH: 2000, // Already enforced in validators
MAX_CALLS_PER_WINDOW: 100,    // Intended rate ceiling per team per minute
```

---

## Known Limitations

- `classifyEmail` is O(n × m) on input length × signal count. For
  `bodyPreview` under 4000 chars and ~50 signals this is negligible.
- The current implementation has no caching — every call re-scans the
  full concatenated string. A future integration could add signal-match
  caching for repeated patterns.
- No streaming or pagination — the execution service operates on a single
  input payload. For bulk ingestion, callers should batch outside this tool.
