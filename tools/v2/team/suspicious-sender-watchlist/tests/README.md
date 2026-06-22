# Suspicious Sender Watchlist — Tests

This directory contains all tests for the Suspicious Sender Watchlist tool.

## Test Structure

- `watchlist.test.mjs` — Core service logic tests (pure functions, no React/DOM)

## Running Tests

The tests use Node's built-in test runner. No npm install or build step is required.

```bash
# Run all tests
node --test tools/v2/team/suspicious-sender-watchlist/tests/watchlist.test.mjs
```

## Test Coverage

The test file covers:

### Fixture Validation
- All entries have required fields with correct types
- Entry distribution matches expected counts (risk levels, statuses)
- Date format is valid ISO-8601

### `computeMetrics`
- Correct counts for total, high/medium/low risk, active/dismissed
- Zero metrics for empty list
- Correct counts for single-entry list

### `applyFilter`
- No filter returns all entries
- Filtering by riskLevel (high, medium, low)
- Filtering by status (active, dismissed)
- Filtering by search (matching email, name, reason — case-insensitive)
- Combined filters (riskLevel + status)
- No-match search returns empty array
- Null/undefined filter fields don't break behavior

### Service Operations
- `getEntries` returns all entries by default and respects filters
- `addEntry` creates entries with correct defaults (auto-id, status=active, today's date)
- `addEntry` persists optional notes
- `updateRisk` changes riskLevel and preserves other fields
- `updateRisk` throws descriptive error for unknown ids
- `dismissEntry` sets status=dismissed
- `dismissEntry` throws for unknown ids
- `removeEntry` permanently deletes entries
- `removeEntry` throws for unknown ids
- `getMetrics` reflects current state after mutations
- Sequential mutations maintain correct state
- Empty initial state works correctly
- Async operations with delay config
- Error handling with failureRate config

## Test Fixtures

Test data is defined inline within `watchlist.test.mjs` to keep tests self-contained.
Source fixtures for development are in `fixtures/watchlist.fixtures.ts`.

The inline fixtures mirror the TypeScript source fixtures and include:

| ID | Email | Risk Level | Status |
|----|-------|-----------|--------|
| watch-001 | noreply@phishing-stealth-alert.example.com | high | active |
| watch-002 | billing@fake-invoice-portal.example.net | high | active |
| watch-003 | promo@bulk-sender-spam.example.org | medium | active |
| watch-004 | support@lookalike-domain.example.com | medium | active |
| watch-005 | newsletter@low-risk-sender.example.io | low | active |
| watch-006 | old-threat@dismissed-example.com | high | dismissed |

## Best Practices

1. **Use local fixtures** — Don't fetch from main app or external sources
2. **Test in isolation** — Mock dependencies via dependency injection
3. **Test behavior, not implementation** — Focus on what the code does, not how
4. **Keep tests maintainable** — Use descriptive names and organize logically
5. **No build step required** — Tests use Node's built-in test runner and plain JavaScript

## Future Tests

When the tool is connected to the main app, add:

- **Component tests**: Render testing for `WatchlistEmptyState`, `WatchlistErrorState`,
  `WatchlistLoadingState`, `WatchlistList`, `WatchlistEntry`, and `SuspiciousSenderWatchlist`
- **Hook tests**: Unit tests for `useWatchlist` with mock services
- **Integration tests**: Full workflow testing (add → filter → dismiss → metrics)
- **Accessibility tests**: Automated a11y audits with axe-core
