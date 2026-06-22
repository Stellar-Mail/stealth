# Test Plan

## Automated Fixture Test

Run from the repository root:

```bash
node --test tools/v2/team/suspicious-sender-watchlist/tests/watchlist.test.mjs
```

Expected result:

- All 6 fixture entries have required fields (id, senderEmail, senderName, reason, riskLevel, status, dateAdded)
- The entry distribution matches: 5 active / 1 dismissed, 3 high-risk / 2 medium-risk / 1 low-risk
- `computeMetrics` returns correct counts for all metrics categories
- `computeMetrics` handles empty lists (all zeros)
- `applyFilter` returns all entries with empty filter
- `applyFilter` correctly filters by riskLevel, status, and search text (case-insensitive)
- `applyFilter` combines multiple filter criteria correctly
- `applyFilter` returns empty array when no entries match
- `addEntry` creates entries with auto-generated id, status=active, and today's date
- `addEntry` persists optional notes when provided
- `updateRisk` changes riskLevel and reflects in subsequent queries
- `updateRisk` throws meaningful error for unknown entry ids
- `dismissEntry` sets status=dismissed and is reflected in filtered queries
- `dismissEntry` throws for unknown entry ids
- `removeEntry` permanently deletes the entry from the store
- `removeEntry` throws for unknown entry ids
- `getMetrics` reflects current state after mutations (add, remove, update)
- Service starts with empty list when given empty initial fixtures
- Service correctly tracks state across multiple sequential mutations
- `applyFilter` with undefined/null fields returns all entries unchanged
- `applyFilter` with combined riskLevel+status+search filter works correctly
- `updateRisk` preserves all other fields on the entry
- Dismissing an already-dismissed entry succeeds without errors
- Removing the last entry transitions to empty list correctly
- Service with delayMs=10 config works (async operations resolve)
- Service with failureRate=1 always throws on operations

## Manual Review Checklist

1. Open `fixtures/watchlist.fixtures.ts`.
2. Confirm all fixture data uses synthetic/anonymous data.
3. Confirm each fixture entry has a distinct id pattern (`watch-001` through `watch-006`).
4. Confirm all risk levels (low, medium, high) and statuses (active, dismissed) are represented.
5. Confirm `docs/review-notes.md` documents out-of-scope live mailbox behavior.
6. Confirm no files outside `tools/v2/team/suspicious-sender-watchlist/` changed.

## Edge Cases Covered

- Empty watchlist (service initialized with `[]`)
- Filtering by multiple criteria simultaneously (riskLevel + status + search)
- Case-insensitive search matching against email, name, and reason fields
- No-match search returning empty array
- Undefined/null filter fields (should return all entries)
- Adding entries with and without optional notes
- Updating risk level preserves all other entry fields
- Dismissing an already-dismissed entry (idempotent)
- Removing the last entry transitions to empty state
- Sequential mutations maintain correct internal state
- Async operations with artificial delay configuration
- Error simulation via failureRate configuration

## Future Integration Tests

When integration with the main app is planned, add tests for:

- Real API data fetching (replacing fixture-based seeding)
- User authentication and authorization for watchlist access
- Cross-user shared watchlist synchronization
- Real-time threat feed integration
- Notification and alerting when high-risk senders are detected
- Bulk import/export of watchlist entries
- Audit log creation for all watchlist mutations
- Performance with large watchlists (1000+ entries)
