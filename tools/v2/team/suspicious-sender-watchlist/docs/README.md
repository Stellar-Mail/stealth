# Suspicious Sender Watchlist

> **V2 team tool — isolated workspace for managing a shared threat database.**

This folder contains the complete Suspicious Sender Watchlist tool, including:
typed execution contract, in-memory service, input guards/sanitizers, React UI
components, deterministic fixtures, and comprehensive test coverage.

**Ownership boundary:** All work must stay inside `tools/v2/team/suspicious-sender-watchlist/`.
Do not wire this tool into the main app, routing, inbox architecture, wallet core,
Stellar core, database schema, or existing design system unless a future integration
issue explicitly allows it.

---

## Table of Contents

- [Architecture](#architecture)
- [Setup](#setup)
- [Usage](#usage)
- [Folder Structure](#folder-structure)
- [Fixtures](#fixtures)
- [Testing](#testing)
- [Known Limitations](#known-limitations)
- [Related Documentation](#related-documentation)

---

## Architecture

The tool is organized into four layers, each with a clear responsibility:

```
┌─────────────────────────────────────────────────────┐
│                     UI Layer                         │
│  components/   hooks/                               │
│  React components + useWatchlist hook               │
├─────────────────────────────────────────────────────┤
│                Contract Layer                        │
│  contract.ts   services/execution-contract.ts        │
│  Typed discriminated result (no throw)              │
├─────────────────────────────────────────────────────┤
│                Service Layer                         │
│  services/watchlist.service.ts                       │
│  In-memory CRUD + filtering + metrics               │
├─────────────────────────────────────────────────────┤
│                Guard Layer                           │
│  guards/watchlist-guards.mjs                        │
│  Input validation, sanitization, size enforcement   │
└─────────────────────────────────────────────────────┘
```

### Layer Responsibilities

| Layer                | Module                           | Responsibility                                                                                                                                           |
| :------------------- | :------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **UI**               | `components/`                    | React components for all states (loading, empty, error, success). Uses `@/components/ui/*` shared primitives.                                            |
| **Hook**             | `hooks/use-watchlist.ts`         | React hook wrapping the service with full `FetchState` lifecycle (loading/error/empty/success).                                                          |
| **Contract**         | `contract.ts`                    | Typed discriminated result type `WatchlistResult<T>` with explicit `WatchlistErrorCode` enum. Never throws.                                              |
| **Contract Adapter** | `services/execution-contract.ts` | Adapts the throw-based service into the non-throwing contract. Single `execute(input)` entry point.                                                      |
| **Service**          | `services/watchlist.service.ts`  | In-memory CRUD: `getEntries`, `addEntry`, `updateRisk`, `dismissEntry`, `removeEntry`, `getMetrics`. Configurable delay and failure rate for testing.    |
| **Guards**           | `guards/watchlist-guards.mjs`    | Input sanitization (`sanitizeText`), per-field validation (email, name, reason, notes, risk level, status), size boundary enforcement (5,000 entry cap). |
| **Fixtures**         | `fixtures/`                      | Deterministic test data: 6 watchlist entries covering all risk levels and statuses (`.example.*` TLDs only).                                             |

### Data Flow

1. Caller (UI component or future integration) invokes `contract.execute({ operation, ... })`.
2. Contract adapter routes to the appropriate service method.
3. Service method calls guard functions to validate/sanitize all untrusted input.
4. Service performs the in-memory operation and returns the result.
5. Contract adapter catches any thrown errors and maps them to typed `WatchlistResult` outcomes.

---

## Setup

### Prerequisites

- Node.js >= 20
- Repository dependencies installed (`npm install` or `bun install` from repo root)

### Installation

No additional installation is required. The tool is self-contained within this folder
and does not need to be mounted in the main application.

### Quick Start

```bash
# Run guard tests (no dependencies)
node --test tools/v2/team/suspicious-sender-watchlist/tests/watchlist-guards.test.mjs

# Run service tests (no dependencies)
node --test tools/v2/team/suspicious-sender-watchlist/tests/watchlist.test.mjs

# Run contract tests (requires node_modules from repo root)
npx vitest run --config tools/v2/team/suspicious-sender-watchlist/vitest.config.ts
```

---

## Usage

### Non-UI Execution Contract (Backend)

The recommended entry point for backend or integration use is the execution contract:

```ts
import { createWatchlistService, createWatchlistContract } from ".";

const contract = createWatchlistContract(createWatchlistService());
const res = await contract.execute({
  operation: "add",
  input: {
    senderEmail: "spoof@bank.example",
    senderName: "Bank",
    reason: "phish",
    riskLevel: "high",
  },
});

if (res.ok) {
  // res.value.entry is the newly created WatchlistEntry
} else {
  // res.error is a WatchlistErrorCode, res.message is human-readable
}
```

### Available Operations

| Operation    | Input                                 | Output                          | Description                       |
| :----------- | :------------------------------------ | :------------------------------ | :-------------------------------- |
| `list`       | `filter?` (riskLevel, status, search) | `{ entries: WatchlistEntry[] }` | List entries, optionally filtered |
| `add`        | `AddEntryInput`                       | `{ entry: WatchlistEntry }`     | Add a new entry                   |
| `updateRisk` | `UpdateRiskInput` (id, riskLevel)     | `{ entry: WatchlistEntry }`     | Change an entry's risk level      |
| `dismiss`    | id                                    | `{ entry: WatchlistEntry }`     | Mark entry as dismissed           |
| `remove`     | id                                    | `{ removedId: string }`         | Permanently remove entry          |
| `metrics`    | (none)                                | `{ metrics: WatchlistMetrics }` | Aggregate counts                  |

### React UI

The UI components can be rendered standalone for preview or integrated later:

```tsx
import { SuspiciousSenderWatchlist } from "./components";

export function MyPage() {
  return <SuspiciousSenderWatchlist />;
}
```

The main component manages its own state internally using the `useWatchlist` hook
and local fixtures. No props required.

### React Hook

For custom UI or future integration:

```tsx
import { useWatchlist } from "./hooks/use-watchlist";
import { WatchlistList, WatchlistEmptyState } from "./components";

function MyCustomView() {
  const { entries, metrics, addEntry, dismissEntry, removeEntry } = useWatchlist();

  if (entries.status === "loading") return <div>Loading...</div>;
  if (entries.status === "error") return <div>Error: {entries.message}</div>;
  if (entries.status === "empty") return <WatchlistEmptyState />;

  return <WatchlistList entries={entries.data} onRemove={removeEntry} />;
}
```

### Direct Service Usage

For programmatic access without the contract layer:

```ts
import { createWatchlistService } from "./services/watchlist.service";

const service = createWatchlistService({ delayMs: 0, failureRate: 0 });
const entries = await service.getEntries({ riskLevel: "high" });
const metrics = await service.getMetrics();
```

---

## Folder Structure

```
suspicious-sender-watchlist/
├── components/                                 # React UI components
│   ├── SuspiciousSenderWatchlist.tsx           # Main app wrapper
│   ├── WatchlistEmptyState.tsx                 # Empty state display
│   ├── WatchlistEntry.tsx                      # Individual entry card
│   ├── WatchlistErrorState.tsx                 # Error state with retry
│   ├── WatchlistList.tsx                       # Success state (list view)
│   ├── WatchlistLoadingState.tsx               # Loading skeleton
│   └── index.ts                                # Export barrel
├── docs/                                       # Documentation
│   ├── ACCESSIBILITY.md                        # WCAG 2.1 AA compliance guide
│   ├── README.md                               # This file
│   ├── review-notes.md                         # Reviewer validation guide
│   ├── security-and-performance.md             # Threat model & performance
│   └── testing.md                              # Comprehensive testing guide
├── fixtures/                                   # Test data
│   ├── contract.fixtures.ts                    # Contract input/output samples
│   └── watchlist.fixtures.ts                   # 6 deterministic entries
├── guards/                                     # Input validation
│   └── watchlist-guards.mjs                    # Sanitizers, validators, size guards
├── hooks/                                      # React hooks
│   └── use-watchlist.ts                        # FetchState lifecycle hook
├── services/                                   # Business logic
│   ├── execution-contract.ts                   # Non-UI contract adapter
│   └── watchlist.service.ts                    # In-memory CRUD service
├── tests/                                      # Test suites
│   ├── contract.test.ts                        # Vitest: contract operations + errors
│   ├── test-plan.md                            # Coverage matrix & manual checklist
│   ├── watchlist-guards.test.mjs               # Node: guard functions (55+ tests)
│   └── watchlist.test.mjs                      # Node: service + guard integration (45+ tests)
├── contract.ts                                 # Typed contract (WatchlistResult, WatchlistErrorCode)
├── index.ts                                    # Public API surface (barrel export)
├── spec.md                                     # Architecture contract & issue categories
├── types.ts                                    # All domain types
└── vitest.config.ts                            # Local Vitest configuration
```

---

## Fixtures

The tool provides deterministic test fixtures in `fixtures/`:

### `watchlist.fixtures.ts`

6 entries covering all risk levels and statuses:

| ID        | Risk   | Status    | Notes                                                  |
| :-------- | :----- | :-------- | :----------------------------------------------------- |
| watch-001 | high   | active    | Known phishing domain; flagged by 3 team members       |
| watch-002 | high   | active    | Fraudulent invoice sender                              |
| watch-003 | medium | active    | High-volume unsolicited bulk mail; unsubscribe broken  |
| watch-004 | medium | active    | Lookalike domain for internal support                  |
| watch-005 | low    | active    | Newsletter with misleading subject lines               |
| watch-006 | high   | dismissed | Previously flagged; domain deactivated; kept for audit |

Convenience exports: `ACTIVE_FIXTURES` (5 entries), `HIGH_RISK_FIXTURES` (3 entries).

### `contract.fixtures.ts`

- `VALID_ADD_INPUT` — Example add-entry payload (email, name, reason, risk level, notes).
- `VALID_UPDATE_RISK_INPUT` — References fixture `watch-001`.
- `SAMPLE_CONTRACT_INPUTS` — Array of all 7 operation shapes for documentation.

---

## Testing

Three automated test suites are provided. See [testing.md](./testing.md) for detailed
documentation and [test-plan.md](../tests/test-plan.md) for the full coverage matrix.

| Suite          | Command                                                                                 | Tests | Dependencies            |
| :------------- | :-------------------------------------------------------------------------------------- | :---- | :---------------------- |
| Guard tests    | `node --test tools/v2/team/suspicious-sender-watchlist/tests/watchlist-guards.test.mjs` | 55+   | None                    |
| Service tests  | `node --test tools/v2/team/suspicious-sender-watchlist/tests/watchlist.test.mjs`        | 45+   | None                    |
| Contract tests | `npx vitest run --config tools/v2/team/suspicious-sender-watchlist/vitest.config.ts`    | 12    | `node_modules` (vitest) |

**Quick run all:**

```bash
node --test tools/v2/team/suspicious-sender-watchlist/tests/ \
  && npx vitest run --config tools/v2/team/suspicious-sender-watchlist/vitest.config.ts
```

---

## Known Limitations

| Limitation                       | Impact                                                                                        | Future Work                                                  |
| :------------------------------- | :-------------------------------------------------------------------------------------------- | :----------------------------------------------------------- |
| **No UI component tests**        | UI changes require manual validation. No automated regression detection for React components. | Add `@testing-library/react` tests for all component states. |
| **No integration with main app** | Tool cannot be accessed from the application shell. No routing or navigation integration.     | Create a follow-up integration issue to mount this tool.     |
| **In-memory persistence only**   | Data is lost on page refresh. No database or IndexedDB backup.                                | Add IndexedDB or backend API in a future issue.              |
| **No pagination**                | Service caps at 5,000 entries via guard but does not implement offset/limit pagination.       | Add pagination to `getEntries()` and UI.                     |
| **No debounced search**          | Search-as-you-type triggers on every keystroke without debouncing.                            | Implement 300ms debounce in `useWatchlist`.                  |
| **No audit trail**               | No recording of who added/removed entries or when.                                            | Add audit-log service in a follow-up issue.                  |
| **No export**                    | Watchlist data cannot be exported as CSV/JSON.                                                | Add export functionality in a feature issue.                 |
| **No Storybook stories**         | Components cannot be visually reviewed in isolation across all states.                        | Add Storybook stories for visual regression testing.         |

---

## Related Documentation

| Document                                                     | Description                                                          |
| :----------------------------------------------------------- | :------------------------------------------------------------------- |
| [Specification](../specs.md)                                 | Architecture contract, issue categories, contributor expectations    |
| [ACCESSIBILITY.md](./ACCESSIBILITY.md)                       | WCAG 2.1 AA compliance guide for UI components                       |
| [testing.md](./testing.md)                                   | Comprehensive testing guide (setup, suites, fixtures, writing tests) |
| [test-plan.md](../tests/test-plan.md)                        | Coverage matrix, manual review checklist, known gaps                 |
| [review-notes.md](./review-notes.md)                         | Reviewer validation guide with verification checklist                |
| [security-and-performance.md](./security-and-performance.md) | Threat model, hostile input categories, performance analysis         |
| [README (root)](../../README.md)                             | Tools workspace overview                                             |

---

## Ownership

**Maintainer:** GrantFox OSS

**Issue tracking:** See the repository issue tracker.

**License:** Same as the parent repository.
