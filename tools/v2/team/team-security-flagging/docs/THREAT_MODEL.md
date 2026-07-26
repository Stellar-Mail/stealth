# Team Security Flagging — Threat Model

## Trust Boundary

The input sanitizers and validators in `services/security-flagging.service.mjs` sit at
the boundary between untrusted caller-supplied input and any downstream classification,
persistence, or review logic. All inputs must be treated as untrusted until validated.

The guard module (`guards/security-guards.mjs`) adds a second layer at the service
execution boundary, enforcing size caps and rate limits before any work begins.

## Threat Assumptions

### 1. Input strings may be adversarially crafted

Attackers can supply email fields, thread IDs, descriptions, and evidence items
containing null bytes, control characters, CRLF sequences, path-traversal sequences,
or Unicode homoglyphs intended to bypass keyword matching or inject into downstream
storage.

**Mitigation:** `sanitizeText()` strips `\x00-\x1F` and `\x7F` before any comparison
or storage. ID fields (`threadId`, `emailId`) enforce `^[\w-]+$`. Email fields reject
`\r`, `\n`, and `\x00`. All fallback to `null` for non-string types.

### 2. Enum values may be wrong case, misspelled, or fabricated

Callers may send `severity: "CRITICAL"`, `category: "hacking"`, or `status: "pending"`
to bypass allowlist checks or trigger unexpected code paths.

**Mitigation:** `validateSeverity`, `validateCategory`, and `validateStatus` perform
case-sensitive inclusion checks against closed allowlists. No unknown value is
coerced or defaulted — every unrecognized value throws `SecurityFlagError` with the
offending field named.

### 3. Array inputs may be oversized

Evidence arrays with hundreds of items or a description field containing 100 KB of
text can cause O(n) memory allocation and degrade downstream consumers.

**Mitigation:** `validateEvidence` enforces a hard cap of `MAX_EVIDENCE_ITEMS` (10)
and `MAX_EVIDENCE_LENGTH` (500) per item. `validateDescription` enforces
`MAX_DESCRIPTION_LENGTH` (2000). The guard module adds a total-body-size check
before any field validation begins.

### 4. Email metadata is a header-injection surface

Sender email addresses and reporter email addresses may contain CRLF sequences
intended to inject into mail headers or log lines.

**Mitigation:** `validateEmail` rejects any string containing `\r`, `\n`, or `\x00`.
It also enforces structural validity (`local@domain.tld`) and a maximum length
(`MAX_EMAIL_LENGTH`: 254).

### 5. Identifier fields may carry path-traversal or XSS payloads

Thread IDs and email IDs may contain `../`, `<script>` tags, or SQL fragments
intended to probe downstream storage or rendering layers.

**Mitigation:** `validateThreadId` and `validateEmailId` enforce `^[\w-]+$`,
rejecting dots, slashes, angle brackets, spaces, and any character outside the
`\w` or `-` sets.

### 6. Non-object or null input may reach the creation path

An attacker may send `null`, a string, or an array where a plain object is
required, bypassing field-level validators entirely.

**Mitigation:** `validateCreateFlagInput` performs an early `typeof` / `Array.isArray`
guard before any field access. Non-plain-object inputs throw immediately with
`SecurityFlagError`.

### 7. Concurrent duplicate submissions may race past the duplicate check

Two callers submitting identical flags in quick succession may both pass the
`findActiveFlag` check before either persists.

**Mitigation:** The execution service treats duplicate checking and persistence
as caller-supplied boundaries (`findActiveFlag`, `persistFlag`). A production
integration should use a unique constraint or compare-and-swap on
`(emailId, threadId)` at the storage layer.

### 8. Large email bodies cause unnecessary classification work

The `classifyEmail` function concatenates subject, snippet, bodyPreview, and
senderEmail into a single lowercase string, then scans it against keyword
signals. An email with a 100 KB bodyPreview forces an O(n) lowercasing and
substring-search pass across the entire text even though only the first few
thousand characters typically contain threat signals.

**Mitigation:** The performance constraints in `docs/PERFORMANCE.md` document
this characteristic and recommend truncating `bodyPreview` to 4000 characters
before calling `classifyEmail()`.

## Hostile Input Categories

### ID fields (threadId, emailId)

| Input | Attack vector | Mitigation |
|---|---|---|
| `../../../etc/passwd` | Path traversal | `^[\w-]+$` |
| `<script>alert(1)</script>` | XSS in downstream UI | `^[\w-]+$` |
| `thread 001` | Space breaks downstream parsing | `^[\w-]+$` |
| `a`.repeat(101) (or 100+) | Buffer/regex exhaustion | Length cap = 100 |
| `null`, `undefined`, `""` | Type/length bypass | `sanitizeText` → null → throw |

### Email fields (senderEmail, reportedBy)

| Input | Attack vector | Mitigation |
|---|---|---|
| `user@evil.test\r\nBcc: victim@test` | CRLF header injection | Reject `\r`, `\n` |
| `user\x00@evil.test` | Null-byte injection | Reject `\x00` |
| `@missinglocal.test` | Structural bypass | Regex `/^[^@\s]+@[^@\s]+\.[^@\s]+$/` |
| `a`.repeat(255) + `@x.test` | Length exhaustion | Length cap = 254 |
| `null`, `""` | Type/length bypass | Throw `SecurityFlagError` |

### Severity / Category / Status (enum fields)

| Input | Attack vector | Mitigation |
|---|---|---|
| `CRITICAL` | Case-sensitivity bypass | Case-sensitive inclusion check |
| `extreme` | Unknown value escalation | Closed allowlist |
| `hacking` | Category-mapping bypass | Closed allowlist |
| `pending` | Unknown status injection | Closed allowlist |
| `null`, `""` | Null/empty bypass | `sanitizeText` → null → throw |

### Description / Evidence (text fields)

| Input | Attack vector | Mitigation |
|---|---|---|
| `x`.repeat(2001) | Memory/DB field overflow | Length cap = 2000 |
| Array of 11+ items | Array-bounds bypass | Length cap = 10 |
| `x`.repeat(501) per item | Per-item overflow | Length cap = 500 |
| `[""]` or `["\x00"]` | Empty/control injection | `sanitizeText` → null → throw |
| Non-array (`"text"`, `null`) | Type confusion | `Array.isArray` guard |

### Execution input (top-level)

| Input | Attack vector | Mitigation |
|---|---|---|
| `null` | Null-object dereference | `typeof` + `Array.isArray` guard |
| `"string"` | Type confusion | `typeof` + `Array.isArray` guard |
| `[]` | Array-as-object bypass | `Array.isArray` guard |
| `{ }` with all fields empty | Empty-object edge case | Per-field validators each throw |
| 1 MB+ JSON payload | Memory DoS | Guard: reject payloads > 64 KB |

## Services Rendered

- `sanitizeText` — strips control characters from any string input
- `validateSeverity`, `validateCategory`, `validateStatus` — closed-enum guards
- `validateEmail` — structure + injection guard for email fields
- `validateThreadId`, `validateEmailId` — ID format guard
- `validateDescription`, `validateEvidence` — length-capped text guards
- `validateCreateFlagInput` — composite input validator
- `guardSecurityFlaggingInput` (in `guards/security-guards.mjs`) — pre-validation payload guard
