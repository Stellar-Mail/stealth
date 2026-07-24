# Reviewer Validation Guide — Suspicious Sender Watchlist

This guide assists reviewers and OSS contributors in validating the security and performance hardening changes.

---

## 1. Quick Verification Checklist

- [ ] Guard tests pass (`node --test tools/v2/team/suspicious-sender-watchlist/tests/watchlist-guards.test.mjs`).
- [ ] Service tests pass (`node --test tools/v2/team/suspicious-sender-watchlist/tests/watchlist.test.mjs`).
- [ ] Prettier formatting is clean.
- [ ] No modifications made to files outside `tools/v2/team/suspicious-sender-watchlist/`.

---

## 2. Running the Test Suites

### Guard Tests (Node.js)

```bash
node --test tools/v2/team/suspicious-sender-watchlist/tests/watchlist-guards.test.mjs
```

_Expected: 55+ tests passed._

### Service Tests (Node.js)

```bash
node --test tools/v2/team/suspicious-sender-watchlist/tests/watchlist.test.mjs
```

_Expected: 21+ tests passed._

---

## 3. Deliverables Overview

### Guards (`guards/watchlist-guards.mjs`)

| Function                | Purpose                                                     |
| ----------------------- | ----------------------------------------------------------- |
| `sanitizeText`          | Strips HTML tags and control characters from free-text      |
| `validateWatchlistId`   | Validates ID format (alphanumeric + `_-`, max 64 chars)     |
| `validateSenderEmail`   | Validates email structure, length, CRLF/null-byte rejection |
| `validateSenderName`    | Validates name length (max 200), sanitizes                  |
| `validateReason`        | Validates reason length (max 500), sanitizes                |
| `validateNotes`         | Validates notes length (max 2000), sanitizes                |
| `validateRiskLevel`     | Allowlist validation: low / medium / high                   |
| `validateEntryStatus`   | Allowlist validation: active / dismissed                    |
| `validateSearchQuery`   | Caps search queries at 100 chars to prevent ReDoS           |
| `guardWatchlistSize`    | Rejects arrays > 5,000 entries before iteration             |
| `validateAddEntryInput` | Composite: runs all validators on add-entry payloads        |

### Service Integration (`services/watchlist.service.ts`)

- `addEntry` validates via `validateAddEntryInput` and `guardWatchlistSize`
- `updateRisk` validates via `validateWatchlistId` and `validateRiskLevel`
- `dismissEntry` validates via `validateWatchlistId`
- `removeEntry` validates via `validateWatchlistId`
- `getMetrics` guards via `guardWatchlistSize`
- `applyFilter` validates risk level and search query

### Documentation (`docs/security-and-performance.md`)

- Threat assumptions and hostile input categories
- Guard layer reference
- Performance notes with O(n) analysis and size limit reasoning

---

## 4. Validation Scenarios

### Hostile Input Rejection

The guards should reject these categories of hostile input:

| Category            | Example payload                            | Expected guard                                     |
| ------------------- | ------------------------------------------ | -------------------------------------------------- |
| Path traversal      | `"../../../etc/passwd"` as ID              | `validateWatchlistId` — `WatchlistValidationError` |
| XSS in name         | `"<script>alert(1)</script>"` as name      | `sanitizeText` strips to `alert(1)`                |
| CRLF injection      | `"user@evil.test\r\nBcc: victim"` as email | `validateSenderEmail` — `WatchlistValidationError` |
| Null byte           | `"user\0@evil.test"` as email              | `validateSenderEmail` — `WatchlistValidationError` |
| Case bypass         | `"HIGH"` or `"CRITICAL"` as risk level     | `validateRiskLevel` — lowercases or rejects        |
| Oversized query     | 101-character search string                | `validateSearchQuery` — `WatchlistValidationError` |
| Oversized watchlist | 5,001+ entry array                         | `guardWatchlistSize` — `WatchlistValidationError`  |
| Malformed email     | `"@domain"`, `"user@"`, `"noatsign"`       | `validateSenderEmail` — `WatchlistValidationError` |

### Happy Path

Standard inputs with reasonable values should pass all guards:

1. Create entry with valid email, name, reason, risk level, optional notes
2. Update risk level on an existing entry
3. Dismiss an entry
4. Remove an entry
5. Get filtered entries
6. Get metrics

---

## 5. Files Changed

All changes are confined to `tools/v2/team/suspicious-sender-watchlist/`:

| File                               | Action    |
| ---------------------------------- | --------- |
| `guards/watchlist-guards.mjs`      | **Added** |
| `docs/security-and-performance.md` | **Added** |
| `docs/review-notes.md`             | **Added** |
| `services/watchlist.service.ts`    | Modified  |
| `tests/watchlist-guards.test.mjs`  | **Added** |

No files outside the tool boundary were modified.
