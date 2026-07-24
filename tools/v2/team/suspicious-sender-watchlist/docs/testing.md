# Testing — Suspicious Sender Watchlist

Comprehensive testing guide for contributors and reviewers.

---

## Overview

The Suspicious Sender Watchlist ships with **three automated test suites** covering:

1. **Input guards & sanitizers** — Validates that every input boundary is hardened against hostile payloads.
2. **Core service logic** — Validates in-memory CRUD operations, filtering, metrics computation, and guard integration at the service boundary.
3. **Non-UI execution contract** — Validates typed input/output discrimination, error mapping, and the promise of never throwing an untyped exception.

All tests are **folder-local**: they live inside `tools/v2/team/suspicious-sender-watchlist/tests/` and import nothing from the main application shell. No UI, no DOM, no network, no database.

---

## Quick Start

### Prerequisites

- **Node.js** >= 20 (for `node --test` runner)
- **Repository dependencies installed** (for Vitest suites): `npm install` or `bun install` from the repo root

### Run All Tests (One Command)

```bash
# Guard + Service (node:test, no dependencies)
node --test tools/v2/team/suspicious-sender-watchlist/tests/

# Contract (Vitest, requires node_modules)
npx vitest run --config tools/v2/team/suspicious-sender-watchlist/vitest.config.ts
```

---

## Test Suites in Detail

### 1. Guard Tests — `tests/watchlist-guards.test.mjs`

**Command:** `node --test tools/v2/team/suspicious-sender-watchlist/tests/watchlist-guards.test.mjs`

**Suite size:** ~55 individual test cases.

Tests every export from `guards/watchlist-guards.mjs`:

| Module Export           | What It Tests                                                         |
| :---------------------- | :-------------------------------------------------------------------- |
| `sanitizeText`          | Non-string handling, HTML stripping, CRLF/null-byte replacement       |
| `validateWatchlistId`   | Valid format, empty/null rejection, path traversal prevention, length |
| `validateSenderEmail`   | Valid structure, CRLF/null-byte injection, malformed rejection        |
| `validateSenderName`    | Empty rejection, HTML sanitization, length boundary                   |
| `validateReason`        | Empty rejection, HTML sanitization, length boundary                   |
| `validateNotes`         | Optional handling, HTML sanitization, length boundary                 |
| `validateRiskLevel`     | Case-insensitive allowlist, invalid level rejection                   |
| `validateEntryStatus`   | Case-insensitive allowlist, invalid status rejection                  |
| `validateSearchQuery`   | Optional handling, length cap, non-string rejection                   |
| `guardWatchlistSize`    | Array validation, size boundary, pagination hint in error message     |
| `validateAddEntryInput` | Composite validation of full AddEntryInput payload                    |
| `LIMITS`                | Correct export of all limit constants                                 |

**Run in isolation:** This suite has zero dependencies — not even a `node_modules` lookup. It imports the `.mjs` guard module directly.

### 2. Service Tests — `tests/watchlist.test.mjs`

**Command:** `node --test tools/v2/team/suspicious-sender-watchlist/tests/watchlist.test.mjs`

**Suite size:** ~45 individual test cases across 4 `describe` blocks.

#### Test Groups

- **Fixtures** — Validates that the 6 deterministic fixture entries are well-formed and correctly distributed across risk levels and statuses.
- **computeMetrics** — Unit tests for the metrics aggregation function: full dataset, empty dataset, single entry.
- **applyFilter** — Unit tests for the filtering logic: by risk level, status, search (email/name/reason), combined filters, and no-match scenarios.
- **Service** — Integration tests for the in-memory service: `getEntries`, `addEntry`, `updateRisk`, `dismissEntry`, `removeEntry`, `getMetrics`, and empty-state lifecycle.
- **Guard Integration (Service)** — Tests that guards are correctly invoked at the service boundary: invalid email, CRLF injection, HTML sanitization, path traversal, capacity limits, and all happy paths.

**Run in isolation:** The service tests inline-replicate the core logic to avoid any TypeScript or ESM import chain. This means they run as plain `.mjs` under `node --test` without any transpilation step.

### 3. Contract Tests — `tests/contract.test.ts`

**Command:** `npx vitest run --config tools/v2/team/suspicious-sender-watchlist/vitest.config.ts`

**Suite size:** 12 test cases.

Tests the non-UI execution contract (`services/execution-contract.ts` and `contract.ts`):

- **Result helpers** — `ok()` and `fail()` produce correctly typed discriminated results.
- **Operation routing** — Every operation (`list`, `add`, `updateRisk`, `dismiss`, `remove`, `metrics`) returns the correct discriminated output type.
- **Error mapping** — Unknown entry IDs map to `WatchlistErrorCode.EntryNotFound`, simulated backend failures map to `WatchlistErrorCode.BackendFailure`. No exceptions propagate to the caller.

**Requires Vitest:** This suite needs `vitest` installed in the repository root (`npm install` / `bun install`).

---

## Fixtures

Test data lives in two fixture modules:

### `fixtures/watchlist.fixtures.ts`

6 deterministic entries used by both the service and contract tests:

| ID        | Email                                      | Risk   | Status    |
| :-------- | :----------------------------------------- | :----- | :-------- |
| watch-001 | noreply@phishing-stealth-alert.example.com | high   | active    |
| watch-002 | billing@fake-invoice-portal.example.net    | high   | active    |
| watch-003 | promo@bulk-sender-spam.example.org         | medium | active    |
| watch-004 | support@lookalike-domain.example.com       | medium | active    |
| watch-005 | newsletter@low-risk-sender.example.io      | low    | active    |
| watch-006 | old-threat@dismissed-example.com           | high   | dismissed |

**Design principles:**

- Every risk level (low, medium, high) is represented.
- Both statuses (active, dismissed) are represented.
- Emails use `.example.com`, `.example.net`, `.example.org`, `.example.io` — reserved TLDs that cannot be registered.
- One entry includes `notes` to exercise optional-field handling.
- Convenience exports `ACTIVE_FIXTURES` and `HIGH_RISK_FIXTURES` are provided for filtered test scenarios.

### `fixtures/contract.fixtures.ts`

Representative inputs for the execution contract tests:

- `VALID_ADD_INPUT` — Full add-entry payload (email, name, reason, risk level, notes).
- `VALID_UPDATE_RISK_INPUT` — References `watch-001` (a known fixture ID).
- `SAMPLE_CONTRACT_INPUTS` — Array covering all 7 contract operations.

**Design principles:**

- Inputs are intentionally simple and valid (happy path).
- IDs reference existing fixture entries for mutation tests.
- All 7 operations are represented in the sample array to document the contract shape.

---

## Writing New Tests

### Guard Tests

Add new `describe`/`it` blocks to `tests/watchlist-guards.test.mjs` following the existing pattern:

```js
describe("Suspicious Sender Watchlist — validateWatchlistId", () => {
  it("rejects IDs with unicode characters", () => {
    assertThrows(() => validateWatchlistId("héllo"), /id/);
  });
});
```

### Service Tests

Add new `describe`/`it` blocks to `tests/watchlist.test.mjs`. If your test needs to verify service behavior with guards, use the `createServiceWithGuards` factory. If it tests pure logic, use the inline `createService` or the standalone `applyFilter`/`computeMetrics` functions.

### Contract Tests

Add new `describe`/`it` blocks to `tests/contract.test.ts` using Vitest's API:

```ts
it("returns INVALID_INPUT for unknown operation", async () => {
  const contract = makeContract();
  const res = await contract.execute({ operation: "unknown" } as any);
  expect(res.ok).toBe(false);
  if (!res.ok) expect(res.error).toBe(WatchlistErrorCode.InvalidInput);
});
```

---

## Continuous Integration

All three suites are designed to run in CI. The guard and service suites need only Node.js (no build step). The contract suite needs `npm install` to be run first (from the repo root) to install Vitest.

**Suggested CI matrix:**

```yaml
test-watchlist:
  steps:
    - run: node --test tools/v2/team/suspicious-sender-watchlist/tests/watchlist-guards.test.mjs
    - run: node --test tools/v2/team/suspicious-sender-watchlist/tests/watchlist.test.mjs
    - run: npx vitest run --config tools/v2/team/suspicious-sender-watchlist/vitest.config.ts
```

---

## Known Limitations

| Limitation                    | Details                                                                                                          |
| :---------------------------- | :--------------------------------------------------------------------------------------------------------------- |
| **No UI component tests**     | The React components (`components/`) have no automated coverage. Manual testing is required for UI changes.      |
| **No E2E tests**              | The tool is not mounted in the main application. End-to-end flows cannot be tested yet.                          |
| **No performance benchmarks** | Filtering and metrics computation lack regression benchmarks. Large-scale performance changes may go undetected. |
| **No mutation testing**       | Test quality (e.g., whether tests actually catch bugs) is not measured.                                          |

For a full list of gaps and future work items, see [test-plan.md](../tests/test-plan.md).
