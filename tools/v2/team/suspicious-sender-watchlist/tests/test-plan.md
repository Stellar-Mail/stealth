# Test Plan — Suspicious Sender Watchlist

This folder keeps its own validation plan so contributors can review it without touching the main application.

---

## Automated Test Suites

The tool has three complementary test suites, all scoped to this folder and free of UI, network, or database dependencies.

### 1. Guard Tests (`watchlist-guards.test.mjs`)

Runs under Node's built-in test runner (`node --test`). No TypeScript transpilation required.

**Command:**

```bash
node --test tools/v2/team/suspicious-sender-watchlist/tests/watchlist-guards.test.mjs
```

**Expected: 55+ tests passed.**

| Area                    | Case                                         | Expected                                |
| :---------------------- | :------------------------------------------- | :-------------------------------------- |
| `sanitizeText`          | Non-string input (null, undefined, number)   | Returns `""`                            |
| `sanitizeText`          | HTML tag stripping (`<script>`, `<b>`, etc.) | Tags removed, text preserved            |
| `sanitizeText`          | CRLF / null-byte replacement                 | Control chars replaced with space       |
| `sanitizeText`          | Safe text preservation                       | Output equals input                     |
| `validateWatchlistId`   | Valid IDs (alphanumeric, `_`, `-`)           | Returns normalized ID                   |
| `validateWatchlistId`   | Empty / null / undefined                     | Throws `WatchlistValidationError`       |
| `validateWatchlistId`   | Path traversal (`../`, `..\\`)               | Throws `WatchlistValidationError`       |
| `validateWatchlistId`   | Whitespace in ID                             | Throws `WatchlistValidationError`       |
| `validateWatchlistId`   | HTML/XSS in ID                               | Throws `WatchlistValidationError`       |
| `validateWatchlistId`   | Max length boundary                          | Accepts at limit, rejects beyond        |
| `validateSenderEmail`   | Valid email structures                       | Returns normalized email                |
| `validateSenderEmail`   | Empty / null / undefined                     | Throws `WatchlistValidationError`       |
| `validateSenderEmail`   | CRLF header injection                        | Throws `WatchlistValidationError`       |
| `validateSenderEmail`   | Null-byte injection                          | Throws `WatchlistValidationError`       |
| `validateSenderEmail`   | Malformed (missing local/domain)             | Throws `WatchlistValidationError`       |
| `validateSenderEmail`   | Exceeds RFC 5321 max length                  | Throws `WatchlistValidationError`       |
| `validateSenderName`    | Valid names                                  | Returns sanitized name                  |
| `validateSenderName`    | Empty / whitespace / null                    | Throws `WatchlistValidationError`       |
| `validateSenderName`    | HTML tag stripping                           | Returns sanitized text                  |
| `validateSenderName`    | Max length boundary                          | Accepts at limit, rejects beyond        |
| `validateReason`        | Valid reasons                                | Returns sanitized reason                |
| `validateReason`        | Empty / null                                 | Throws `WatchlistValidationError`       |
| `validateReason`        | HTML tag stripping                           | Returns sanitized text                  |
| `validateReason`        | Max length boundary                          | Accepts at limit, rejects beyond        |
| `validateNotes`         | Valid notes                                  | Returns sanitized notes                 |
| `validateNotes`         | Undefined/null returns `""`                  | Returns `""`                            |
| `validateNotes`         | Non-string rejects                           | Throws `WatchlistValidationError`       |
| `validateNotes`         | HTML stripping                               | Returns sanitized text                  |
| `validateNotes`         | Max length boundary                          | Accepts at limit, rejects beyond        |
| `validateRiskLevel`     | Valid levels (case-insensitive)              | Returns lowercase level                 |
| `validateRiskLevel`     | Empty / null                                 | Throws `WatchlistValidationError`       |
| `validateRiskLevel`     | Invalid levels (`critical`, `very high`)     | Throws `WatchlistValidationError`       |
| `validateEntryStatus`   | Valid statuses (case-insensitive)            | Returns lowercase status                |
| `validateEntryStatus`   | Empty / null                                 | Throws `WatchlistValidationError`       |
| `validateEntryStatus`   | Invalid statuses (`deleted`, `pending`)      | Throws `WatchlistValidationError`       |
| `validateSearchQuery`   | Valid search queries                         | Returns trimmed query                   |
| `validateSearchQuery`   | Undefined/null returns `""`                  | Returns `""`                            |
| `validateSearchQuery`   | Non-string rejects                           | Throws `WatchlistValidationError`       |
| `validateSearchQuery`   | Max length boundary                          | Accepts at limit, rejects beyond        |
| `guardWatchlistSize`    | Empty array                                  | Returns `true`                          |
| `guardWatchlistSize`    | Array under limit                            | Returns `true`                          |
| `guardWatchlistSize`    | Array at limit (uses `>=` semantics)         | Throws `WatchlistValidationError`       |
| `guardWatchlistSize`    | Array one below limit                        | Returns `true`                          |
| `guardWatchlistSize`    | Array exceeding limit                        | Throws `WatchlistValidationError`       |
| `guardWatchlistSize`    | Non-array input                              | Throws `WatchlistValidationError`       |
| `guardWatchlistSize`    | Error message includes pagination hint       | Contains "paginate" and limit number    |
| `validateAddEntryInput` | Well-formed input                            | Returns sanitized fields                |
| `validateAddEntryInput` | Input with notes                             | Returns sanitized fields with notes     |
| `validateAddEntryInput` | Sanitizes text fields                        | HTML stripped from name and reason      |
| `validateAddEntryInput` | Non-object input                             | Throws `WatchlistValidationError`       |
| `validateAddEntryInput` | Invalid email                                | Throws `WatchlistValidationError`       |
| `validateAddEntryInput` | Invalid risk level                           | Throws `WatchlistValidationError`       |
| `validateAddEntryInput` | Empty name                                   | Throws `WatchlistValidationError`       |
| `validateAddEntryInput` | Empty reason                                 | Throws `WatchlistValidationError`       |
| `validateAddEntryInput` | Case normalization of risk level             | Returns lowercase risk level            |
| `LIMITS`                | All expected constants exported              | Has all 7 limit + 2 allowlist constants |
| `LIMITS`                | Allowed risk levels                          | `["low", "medium", "high"]`             |
| `LIMITS`                | Allowed entry statuses                       | `["active", "dismissed"]`               |

### 2. Service Tests (`watchlist.test.mjs`)

Runs under Node's built-in test runner (`node --test`). Replicates core service logic and guard integration inline for zero-dependency execution.

**Command:**

```bash
node --test tools/v2/team/suspicious-sender-watchlist/tests/watchlist.test.mjs
```

**Expected: 21+ tests passed.**

| Area                  | Case                                       | Expected                                 |
| :-------------------- | :----------------------------------------- | :--------------------------------------- |
| **Fixtures**          | 6 fixture entries total                    | Length === 6                             |
| Fixtures              | 5 active, 1 dismissed                      | Correct counts                           |
| Fixtures              | 3 high, 2 medium, 1 low risk               | Correct distribution                     |
| Fixtures              | Every entry has required fields            | All fields present and valid             |
| **computeMetrics**    | Correct totals for fixtures                | Total 6, high 3, medium 2, low 1, ...    |
| computeMetrics        | Zero metrics for empty list                | All values === 0                         |
| computeMetrics        | Single-entry list                          | Correct single counts                    |
| **applyFilter**       | Empty filter returns all                   | 6 entries                                |
| applyFilter           | Filter by riskLevel=high                   | 3 entries, all high                      |
| applyFilter           | Filter by riskLevel=low                    | 1 entry (watch-005)                      |
| applyFilter           | Filter by status=dismissed                 | 1 entry (watch-006)                      |
| applyFilter           | Filter by status=active                    | 5 entries, all active                    |
| applyFilter           | Search by senderEmail                      | 1 match (watch-001 for "phishing")       |
| applyFilter           | Search by senderName (case-insensitive)    | 1 match (watch-002 for "invoice portal") |
| applyFilter           | Search by reason                           | 1 match (watch-003 for "bulk")           |
| applyFilter           | Search with no matches                     | Empty array                              |
| applyFilter           | Combined riskLevel + status filter         | 1 match (high + dismissed = watch-006)   |
| **Service**           | getEntries returns all fixtures            | 6 entries                                |
| Service               | getEntries respects riskLevel filter       | 2 medium entries                         |
| Service               | addEntry creates with status=active + date | Valid id, active, today's date           |
| Service               | addEntry persists notes                    | Notes field matches                      |
| Service               | updateRisk changes riskLevel               | Updated reflects in getEntries           |
| Service               | updateRisk throws for unknown id           | Rejects with /not found/                 |
| Service               | dismissEntry sets status=dismissed         | Removed from active entries              |
| Service               | dismissEntry throws for unknown id         | Rejects with /not found/                 |
| Service               | removeEntry deletes permanently            | Entry gone from getEntries               |
| Service               | removeEntry throws for unknown id          | Rejects with /not found/                 |
| Service               | getMetrics reflects state after mutations  | Correct totals after remove              |
| Service               | Empty initial list, tracks additions       | Starts at 0, grows to 1                  |
| **Guard Integration** | addEntry rejects invalid email             | WatchlistValidationError                 |
| Guard Integration     | addEntry rejects CRLF injection            | WatchlistValidationError                 |
| Guard Integration     | addEntry rejects invalid risk level        | WatchlistValidationError                 |
| Guard Integration     | addEntry rejects empty name                | WatchlistValidationError                 |
| Guard Integration     | addEntry sanitizes HTML                    | Tags stripped from name and reason       |
| Guard Integration     | addEntry normalizes risk level case        | HIGH → high                              |
| Guard Integration     | addEntry rejects empty reason              | WatchlistValidationError                 |
| Guard Integration     | updateRisk rejects malformed ID            | WatchlistValidationError                 |
| Guard Integration     | updateRisk rejects invalid risk level      | WatchlistValidationError                 |
| Guard Integration     | updateRisk accepts case-variant level      | HIGH → high                              |
| Guard Integration     | updateRisk rejects path traversal in ID    | WatchlistValidationError                 |
| Guard Integration     | dismissEntry rejects null ID               | WatchlistValidationError                 |
| Guard Integration     | dismissEntry rejects path traversal        | WatchlistValidationError                 |
| Guard Integration     | removeEntry rejects empty ID               | WatchlistValidationError                 |
| Guard Integration     | removeEntry rejects XSS in ID              | WatchlistValidationError                 |
| Guard Integration     | getMetrics one below limit passes          | Returns correct metrics                  |
| Guard Integration     | getMetrics oversized throws                | WatchlistValidationError                 |
| Guard Integration     | applyFilter oversized returns empty        | Empty array                              |
| Guard Integration     | addEntry at capacity throws                | WatchlistValidationError                 |
| Guard Integration     | addEntry happy path                        | Succeeds with valid input                |
| Guard Integration     | updateRisk happy path                      | Succeeds with valid input                |
| Guard Integration     | dismissEntry happy path                    | Succeeds with valid input                |
| Guard Integration     | removeEntry happy path                     | Succeeds with valid input                |

### 3. Contract Tests (`contract.test.ts`)

Runs under Vitest with TypeScript support. Tests the non-UI execution contract, result helpers, and error mapping.

**Command:**

```bash
npx vitest run --config tools/v2/team/suspicious-sender-watchlist/vitest.config.ts
```

**Expected: 12+ tests passed.**

| Area               | Case                                                  | Expected                                |
| :----------------- | :---------------------------------------------------- | :-------------------------------------- |
| **Result Helpers** | `ok()` produces typed success                         | `{ ok: true, value: 42 }`               |
| Result Helpers     | `fail()` produces typed error with code + message     | `{ ok: false, error, message }`         |
| **Operations**     | list returns seeded entries                           | `ok=true`, array with length > 0        |
| Operations         | list with riskLevel filter narrows correctly          | Every returned entry is high-risk       |
| Operations         | add returns entry with generated id + active          | id matches pattern, status === "active" |
| Operations         | updateRisk changes risk level                         | Entry watch-001 riskLevel === "medium"  |
| Operations         | dismiss marks entry dismissed                         | Entry status === "dismissed"            |
| Operations         | remove deletes and reports removedId                  | removedId matches, entry gone from list |
| Operations         | metrics returns aggregate counts                      | totals > 0, highRisk > 0                |
| **Error Handling** | dismiss unknown id → EntryNotFound (no throw)         | `ok=false`, error === EntryNotFound     |
| Error Handling     | remove unknown id → EntryNotFound (no throw)          | `ok=false`, error === EntryNotFound     |
| Error Handling     | Simulated backend failure → BackendFailure (no throw) | `ok=false`, error === BackendFailure    |

---

## Manual Review Checklist

1. Open `fixtures/watchlist.fixtures.ts` and confirm:
   - [ ] 6 deterministic fixture entries exist
   - [ ] Entries cover all risk levels (low, medium, high)
   - [ ] Entries cover both statuses (active, dismissed)
   - [ ] Every entry has all required fields populated
   - [ ] `ACTIVE_FIXTURES` and `HIGH_RISK_FIXTURES` convenience exports are present
2. Open `fixtures/contract.fixtures.ts` and confirm:
   - [ ] `VALID_ADD_INPUT` is a legitimate add-entry payload
   - [ ] `VALID_UPDATE_RISK_INPUT` references a known fixture ID
   - [ ] `SAMPLE_CONTRACT_INPUTS` covers all 7 operations
3. Open `guards/watchlist-guards.mjs` and confirm all 11 exports are present
4. Confirm every file changed by this issue lives inside `tools/v2/team/suspicious-sender-watchlist/`
5. Confirm the tool is still isolated from:
   - [ ] Main application shell
   - [ ] Dashboard layout / navigation
   - [ ] Authentication / wallet core
   - [ ] Mail rendering engine / inbox architecture
   - [ ] Existing routing
   - [ ] Stellar integration core
   - [ ] Database schema
   - [ ] Existing design system

---

## Known Limitations and Gaps

| Gap                                       | Impact                                                                                                                     | Future Work                                                                                          |
| :---------------------------------------- | :------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------- |
| **No UI component tests**                 | UI components (React/TSX) have no automated test coverage. Visual regressions or accessibility breaks would go undetected. | Add vitest + @testing-library/react tests for each component state (loading, empty, error, success). |
| **No integration tests against main app** | Tool is not wired into the application shell. No end-to-end flow coverage.                                                 | A future integration issue should add E2E tests after mounting the tool.                             |
| **No Storybook stories**                  | Components cannot be visually reviewed in isolation across states.                                                         | Add Storybook stories for all 5 states of the main component.                                        |
| **In-memory persistence only**            | Data is lost on page refresh. No database backup.                                                                          | Add IndexedDB or backend API integration in a follow-up issue.                                       |
| **No pagination in service or UI**        | The guard layer caps at 5,000 entries, but neither the service nor UI implements paging.                                   | Add offset/limit pagination to `getEntries()` and UI list.                                           |
| **No debounced search**                   | Search-as-you-type recomputes on every keystroke.                                                                          | Implement 300ms debounce in the hook before calling `getEntries()`.                                  |
| **No audit trail**                        | No recording of who added/removed entries or when.                                                                         | Add an audit-log service integration in a future issue.                                              |
| **No export capability**                  | Watchlist data cannot be exported as CSV/JSON.                                                                             | Add export functionality in a follow-up feature issue.                                               |

---

## Running All Tests (Quick Reference)

```bash
# 1. Guard tests (Node built-in, no dependencies)
node --test tools/v2/team/suspicious-sender-watchlist/tests/watchlist-guards.test.mjs

# 2. Service tests (Node built-in, no dependencies)
node --test tools/v2/team/suspicious-sender-watchlist/tests/watchlist.test.mjs

# 3. Contract tests (Vitest, requires node_modules from repo root)
npx vitest run --config tools/v2/team/suspicious-sender-watchlist/vitest.config.ts

# 4. All Node tests at once
node --test tools/v2/team/suspicious-sender-watchlist/tests/

# 5. Verify formatting
npx prettier --check tools/v2/team/suspicious-sender-watchlist/
```
