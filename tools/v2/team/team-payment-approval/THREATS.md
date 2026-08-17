# Team Payment Approval — Threat Model & Unsafe Input Catalog

This document records the threat assumptions and unsafe input vectors for the
Team Payment Approval tool. It is the source of truth for what the guards in
`services/guards.ts` defend against.

## Threat Assumptions

1. **Input is untrusted.** Every field on `PaymentApprovalInput` and
   `PaymentApprovalContext` originates from a caller we do not control. The
   executor may be called from APIs, tests, automation scripts, or future
   integrations — never assume the caller is benevolent.

2. **The tool runs in a browser-first context.** localStorage is accessible,
   DOMPurify is not available (no DOM in the execution service), and the
   execution service must never throw for input-driven paths.

3. **No network calls.** The guards are pure and deterministic. They do not
   reach out to external services. This means the tool cannot rely on
   server-side validation as a safety net.

4. **The store is injected.** The `PaymentApprovalStore` interface is
   dependency-injected. We cannot assume the store sanitizes its own data.
   Guards must run _before_ data reaches the store.

5. **Future integration risk.** When this tool is eventually wired into the
   main app, the input surface may expand. The guard layer is designed to be
   extended without modifying the core execution engine.

## Unsafe Input Catalog

### 1. Missing or Empty Required Fields

| Field        | Vector                                         | Risk                                             |
| ------------ | ---------------------------------------------- | ------------------------------------------------ |
| `paymentId`  | Empty string `""`, whitespace-only `"   "`     | Lookups against the store return `undefined`;    |
|              |                                                | could cause silent no-ops if not caught.         |
| `approverId` | Empty string, whitespace-only                  | Audit trail records an anonymous or blank actor. |
| `decision`   | Any string other than `"approve"` / `"reject"` | Invalid state transition; breaks contract.       |

**Guard:** `validatePaymentApprovalInput()` rejects these with
`VALIDATION_FAILED` before any store interaction.

### 2. Oversized String Fields

| Field          | Vector                        | Risk                                        |
| -------------- | ----------------------------- | ------------------------------------------- |
| `paymentId`    | 10,000+ character string      | Map key bloat, log flooding.                |
| `approverId`   | 10,000+ character string      | Audit record bloat.                         |
| `notes`        | Multi-megabyte free-form text | Memory pressure, log flooding, UI hang.     |
| `context.role` | Very long role string         | Unbounded comparison against allowed roles. |

**Guard:** `checkInputLimits()` enforces per-field character maximums defined
in `GUARD_LIMITS`. Oversized input is rejected with `INPUT_TOO_LARGE`.

### 3. Injection & Encoding Attacks

| Vector                          | Risk                                             |
| ------------------------------- | ------------------------------------------------ |
| Unicode control characters      | Zero-width joiners can hide content; null bytes  |
| (U+0000–U+0008, U+000B–U+001F)  | can truncate C strings in some backends.         |
| Invisible characters            | Zero-width spaces (U+200B–U+200D) can make text  |
| (U+200B–U+200D, U+2060, U+FEFF) | appear empty while containing hidden content.    |
| NFC normalization bypass        | Different byte representations of the same glyph |
|                                 | could evade string-contains checks.              |
| HTML/script injection in notes  | If notes are ever rendered in HTML downstream,   |
|                                 | unescaped content could execute scripts.         |
| Header injection in notes       | Newline/carriage-return in notes could forge     |
|                                 | email headers if notes flow into mail.           |

**Guard:** `sanitizeText()` performs NFC normalization, strips control
characters, and removes invisible characters. All string inputs pass through
sanitization before reaching the engine.

### 4. Malicious Numeric Values

| Field               | Vector                        | Risk                                   |
| ------------------- | ----------------------------- | -------------------------------------- |
| `amount` (on store) | `NaN`, `Infinity`,            | Arithmetic overflow, corrupted totals, |
|                     | negative numbers              | infinite loops in sum reducers.        |
| `approvalLimit`     | `NaN`, `Infinity`,            | Limit checks silently pass or fail.    |
|                     | negative                      |                                        |
| `amount`            | `Number.MAX_SAFE_INTEGER + 1` | Precision loss, incorrect comparisons. |

**Guard:** `sanitizeAmount()` rejects non-finite and negative values.
`isFiniteNumber()` is used as a pre-check. The guard layer normalizes amounts
to finite, non-negative numbers.

### 5. Prototype Pollution

| Vector                                       | Risk                                 |
| -------------------------------------------- | ------------------------------------ |
| `__proto__`, `constructor`, `prototype` keys | Object prototype mutation; potential |
| in `allowedRoles` or other object fields     | cross-component contamination.       |
| Nested object injection via `context`        | Prototype chain pollution.           |

**Guard:** `isPrototypeSafe()` checks that no key in an object is
`__proto__`, `constructor`, or `prototype`. Used before any object spread or
merge operations.

### 6. ReDoS (Regular Expression Denial of Service)

| Vector                                   | Risk                               |
| ---------------------------------------- | ---------------------------------- |
| Crafted input that triggers catastrophic | CPU exhaustion; browser tab hangs. |
| backtracking in regex patterns           |                                    |

**Guard:** The guard module does not use regex patterns on user input. The
only regex usage is for stripping control/invisible characters, which uses
simple character-class patterns with O(n) complexity. `isRegexSafe()` is
available as a utility for future contributors who add regex patterns.

### 7. Date/Time Injection

| Field       | Vector                         | Risk                                 |
| ----------- | ------------------------------ | ------------------------------------ |
| `decidedAt` | Invalid ISO string             | `NaN` timestamp in audit record.     |
|             | Extremely far future/past date | Sorting breaks; deadline checks      |
|             |                                | produce meaningless results.         |
|             | Non-string, non-Date object    | Unexpected behavior in `new Date()`. |

**Guard:** `normalizeDate()` validates the parsed timestamp is finite. Invalid
dates fall back to `Date.now()`. The guard rejects non-string/non-Date types
for `decidedAt`.

### 8. Authorization Bypass

| Vector                                      | Risk                                   |
| ------------------------------------------- | -------------------------------------- |
| Missing `context` in production usage       | Authorization check is skipped; any    |
|                                             | caller can approve/reject.             |
| Role string casing ("Manager" vs "manager") | Case-sensitive comparison could bypass |
|                                             | the allow-list.                        |
| Empty `allowedRoles` array                  | No role is ever authorized.            |

**Guard:** `validateContext()` checks structure only. The `authorized()` function
in `execution.service.ts` uses `Array.includes()` (case-sensitive). Callers
should normalize role casing before constructing context. The guard documents
this as a known caller responsibility.

### 9. localStorage Poisoning (Decision Service)

| Vector                               | Risk                                  |
| ------------------------------------ | ------------------------------------- |
| Tampered JSON in localStorage        | `JSON.parse()` on poisoned data could |
|                                      | inject prototype properties.          |
| Extremely large localStorage payload | Memory exhaustion; parse delays.      |
| Non-array JSON in localStorage       | `.forEach()` on non-array crashes.    |

**Guard:** `decision.service.ts` already uses try/catch around
localStorage operations. The `guards.ts` module provides
`safeJsonParse()` for additional hardening. Future storage reads should
use `safeJsonParse()` with a schema check instead of raw `JSON.parse()`.

### 10. Unbounded Collection Growth

| Collection             | Vector                          | Risk                                |
| ---------------------- | ------------------------------- | ----------------------------------- |
| `paymentService` maps  | Adding millions of payments     | Memory exhaustion in browser.       |
| `decisionService` maps | Recording millions of decisions | Memory exhaustion; localStorage     |
|                        |                                 | quota exceeded.                     |
| `decisions` array      | Multiple decisions per payment  | Unbounded growth if ALREADY_DECIDED |
| (in paymentService)    | check is bypassed.              | check is bypassed.                  |

**Guard:** `checkInputLimits()` enforces maximum counts. The guards module
also provides `batchSizeGuard()` for paginating large datasets and
`trimCollection()` for capping collection sizes. Callers processing large
volumes should use these utilities.

## Guard Coverage Summary

| Threat Category        | Guard Function(s)                          | Error Code          |
| ---------------------- | ------------------------------------------ | ------------------- |
| Missing/empty fields   | `validatePaymentApprovalInput()`           | `VALIDATION_FAILED` |
| Oversized strings      | `checkInputLimits()`                       | `INPUT_TOO_LARGE`   |
| Encoding attacks       | `sanitizeText()`, `sanitizeInput()`        | (preemptive)        |
| Malicious numerics     | `sanitizeAmount()`, `isFiniteNumber()`     | `VALIDATION_FAILED` |
| Prototype pollution    | `isPrototypeSafe()`                        | `VALIDATION_FAILED` |
| ReDoS                  | `isRegexSafe()` (utility)                  | `VALIDATION_FAILED` |
| Date injection         | `normalizeDate()`                          | `VALIDATION_FAILED` |
| Authorization bypass   | `validateContext()`, `authorized()` (exec) | `UNAUTHORIZED`      |
| localStorage poisoning | `safeJsonParse()`                          | (preemptive)        |
| Unbounded growth       | `batchSizeGuard()`, `trimCollection()`     | `INPUT_TOO_LARGE`   |

## Acceptance Criteria Traceability

| Criterion                                      | Evidence                                        |
| ---------------------------------------------- | ----------------------------------------------- |
| Tool has explicit handling for malformed or    | `validatePaymentApprovalInput()` rejects all    |
| hostile input                                  | malformed inputs before store interaction.      |
| Tool avoids unnecessary work on large datasets | `checkInputLimits()` rejects oversized input    |
|                                                | early; `batchSizeGuard()` / `trimCollection()`  |
|                                                | cap processing.                                 |
| No existing security-sensitive app code is     | All guards are folder-local to                  |
| modified                                       | `tools/v2/team/team-payment-approval/`.         |
| Files changed are limited to $rel/             | Every file in this issue is inside              |
|                                                | `tools/v2/team/team-payment-approval/`.         |
| Contribution is reviewable as self-contained   | This document + guards.ts + guards.test.ts form |
| mini-product change                            | a reviewable safety delta.                      |
