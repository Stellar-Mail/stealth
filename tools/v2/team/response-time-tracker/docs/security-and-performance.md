# Security & Performance Constraints — Response Time Tracker

This document defines the safety boundaries, threat assumptions, input
sanitisation rules, and performance constraints for the Response Time Tracker
tool.

---

## 1. Threat Model & Unsafe Inputs

### XSS & HTML Injection (Cross-Site Scripting)

- **Vector**: A malicious actor injects HTML tags or `<script>` payloads into
  the `subject`, `from`, or `to` fields of a response-time entry. If these
  values are rendered without escaping, the script executes in the browser of
  anyone viewing the tracker.
- **Guard Policy**: All free-text fields pass through `sanitizeText()`, which
  strips HTML tags (`/<[^>]*>/g`) before any state update. Subject lines use
  `sanitizeSubject()`, which additionally strips control characters.

### HTTP Header / CRLF Injection

- **Vector**: Injecting carriage returns (`\r`) or line feeds (`\n`) in email
  fields (`from`, `to`, `subject`) to hijack HTTP response headers or mail
  headers when data is rendered or exported.
- **Guard Policy**: Email fields and subject lines reject control characters
  (`\r`, `\n`, `\0`). All sanitised text replaces these with spaces.

### Invalid Date / Timestamp Injection

- **Vector**: Providing a malformed `sentAt`, `respondedAt`, or date-range
  string (e.g. `"not-a-date"`, `"0000-00-00"`) causes `new Date()` to produce
  `NaN`, resulting in infinite loops, crashes, or incorrect metrics.
- **Guard Policy**: `validateDateString()` checks that the input is a string
  and that `new Date(str).getTime()` is not `NaN`. `validateDateRange()` also
  checks that `end` >= `start` and that the span ≤ 365 days.

### Non-Finite / Negative Response Time

- **Vector**: A `responseTimeMs` value of `NaN`, `Infinity`, `-Infinity`, or a
  negative number breaks sort order, average calculation, median computation,
  and SLA classification.
- **Guard Policy**: `validateResponseTimeMs()` enforces a finite non-negative
  number within `[0, 7776000000]` (0 ms to 90 days).

### Status Injection / Enum Bypass

- **Vector**: Providing an unexpected status string (e.g. `"invalid"`,
  `"INVALID"`, `"<script>"`) bypasses SLA classification logic and can corrupt
  metrics.
- **Guard Policy**: `validateStatus()` uses a `Set.has()` allowlist (exact,
  case-sensitive match) for `"met"`, `"missed"`, `"breached"`. The `Set`
  lookup prevents ReDoS and is O(1).

### ID Injection / Path Traversal

- **Vector**: Forging entry IDs, thread IDs, or team-member IDs containing
  directory traversals (e.g. `../../secret`), spaces, or special characters to
  confuse rendering or leak context.
- **Guard Policy**: All IDs are validated against `/^[a-zA-Z0-9_-]+$/` with
  length limits (max 64 chars). This blocks slashes, dots, spaces, and
  non-ASCII characters.

### Oversized Collection DoS

- **Vector**: Feeding tens of thousands of entries or members into the service
  at once causes browser memory exhaustion, hangs during sort/filter, or O(n²)
  metric calculation blow-up.
- **Guard Policy**: `guardEntriesCount()` rejects arrays > 10,000 entries.
  `guardMembersCount()` rejects arrays > 500 members. These guards are called
  before any iteration.

### Unbounded Date Range

- **Vector**: Specifying an extreme date range (e.g. `"1970-01-01"` to
  `"2099-12-31"`) that matches every entry in a large dataset, defeating
  client-side filtering.
- **Guard Policy**: `validateDateRange()` caps the span to 365 days.

---

## 2. Input Validation & Guards Specification

All validators live in `guards/response-time-guards.mjs` and follow the
same pattern:

- Pure, synchronous functions — no I/O, no side effects.
- Throw `RTTValidationError` (extends `Error`) with a `.field` property on
  first invalid input.
- Accept `unknown` types — guard at the boundary.

| Guard Function               | Input            | Checks                                                                 |
|------------------------------|------------------|------------------------------------------------------------------------|
| `sanitizeText(raw)`          | `unknown`        | Strips HTML tags, CR, LF, null. Returns `""` for non-strings.          |
| `sanitizeSubject(subject)`   | `unknown`        | Strips control characters, trims, caps at 998 chars.                   |
| `validateEntryId(id)`        | `unknown`        | Non-empty string, max 64 chars, `/^[a-zA-Z0-9_-]+$/`.                  |
| `validateThreadId(id)`       | `unknown`        | Non-empty string, max 64 chars, `/^[a-zA-Z0-9_-]+$/`.                  |
| `validateTeamMemberId(id)`   | `unknown`        | Non-empty string, max 64 chars, `/^[a-zA-Z0-9_-]+$/`.                  |
| `validateEmailField(email)`  | `unknown`        | Non-empty, max 254 chars, no CR/LF/null, has `@` with local + domain.  |
| `validateStatus(status)`     | `unknown`        | Exact match in `{"met","missed","breached"}`.                          |
| `validateDateString(str)`    | `unknown`        | Non-empty string, `new Date(str)` is not `NaN`.                        |
| `validateResponseTimeMs(ms)` | `unknown`        | Finite number, ≥ 0, ≤ 7_776_000_000 (90 days).                         |
| `validateDateRange(range)`   | `unknown`        | Plain object with valid start/end, end ≥ start, span ≤ 365 days.       |
| `guardEntriesCount(arr)`     | `unknown`        | Array, length ≤ 10_000.                                                |
| `guardMembersCount(arr)`     | `unknown`        | Array, length ≤ 500.                                                   |
| `validateEntryInput(obj)`    | `unknown`        | Composes all field validators for a complete entry object.             |

---

## 3. Performance & Resource Constraints

### Large Entry Histories

- **Issue**: The `calculateMetrics()` function sorts the entire entry array
  (O(n log n)), then iterates it three separate times (reduce, three
  `filter` calls). With 10k+ entries this causes noticeable UI jank.
- **Mitigation**:
  - `guardEntriesCount()` caps the input at 10,000 entries before processing.
  - Future integration should push aggregation to the server side.
  - The fixtures ship with 7 entries — intentionally small for development.

### Unoptimised Date Filter

- **Issue**: `filterByDateRange()` calls `new Date(e.sentAt).getTime()` once
  per entry. In an unguarded large dataset this adds up.
- **Mitigation**: The date-range validation caps span to 365 days, and the
  entry count guard limits total entries processed.

### Multiple Array Passes in Metrics

- **Issue**: `calculateMetrics()` calls `entries.reduce()`, three
  `entries.filter()` calls, and one `entries.sort()`, totalling O(n) + O(n)
  + O(n log n). Each filter re-scans the whole array.
- **Mitigation**: Guard count limits the n. Could be optimised in a future
  pass with a single `reduce` that collects sum, count, and status buckets
  simultaneously.

### Large Team Member Lists

- **Issue**: Rendering 500+ team members for name-lookup dropdowns consumes
  DOM and memory.
- **Mitigation**: `guardMembersCount()` sets an upper bound of 500 members.
  The fixture provides 3 members for development.

### Date Parsing in Guards

- **Issue**: `validateDateString()` and `validateDateRange()` parse dates
  twice (once in validate, once in usage).
- **Mitigation**: Performance impact is negligible at fixture scale. For
  production, consider passing parsed timestamps through the pipeline.

### Unbounded Simulated Delay

- **Issue**: The `delayMs` config accepts arbitrary values. A value of
  `Number.MAX_SAFE_INTEGER` would hang the UI indefinitely.
- **Mitigation**: The service clamps `delayMs` to `[0, 10_000]` when
  `validateServiceConfig()` is invoked. (This guard is applied at the
  service boundary; see `response-time-service.ts`.)

---

## 4. Fixture Safety

The provided fixtures (`fixtures/sample-response-times.json` and
`fixtures/team-members.json`) are static JSON files containing only
allowlisted characters. They are verified by the guards test to pass all
validations when loaded as `ResponseTimeEntry` objects.
