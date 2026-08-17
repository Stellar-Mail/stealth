# Test Plan — Response Time Tracker

## Automated Tests

Run from the repository root:

```bash
node --test tools/v2/team/response-time-tracker/tests/response-time.test.mjs
node --test tools/v2/team/response-time-tracker/tests/execution-contract.test.mjs
```

### What the automated test covers

1. **Service: getEntries** — Returns all fixture entries, respects date filtering.
2. **Service: getMetrics** — Computes correct average, median, min, max, SLA %.
3. **Service: empty metrics** — All-zero metrics when no entries exist.
4. **Service: error handling** — Throws when failure rate is 100%.
5. **Service: date filtering** — Returns empty array when range matches nothing.
6. **Execution contract: success cases** — No range, a narrowing range, and a
   range matching nothing all resolve `{ ok: true, data: ... }`
   (`fixtures/execution-contract-cases.json`).
7. **Execution contract: failure cases** — An inverted range, an unparseable
   date bound, and a simulated service failure all resolve
   `{ ok: false, error: { code, message } }` with the expected error code.
8. **Execution contract: result shape** — `runResponseTimeQuery` never throws,
   and `data`/`error` are mutually exclusive on the returned result.

## Manual Review Steps

### Visual / UI Review (in browser)

1. Open the tool by rendering `ResponseTimeTracker` in a test route or Storybook.
2. **Loading state**: Should appear for ~800 ms on first load (skeleton placeholders).
3. **Success state**: Metrics grid (6 cards) and 7 entry rows should render.
4. **Empty state**: Change date range to a period with no data (e.g., last year).
5. **Error state**: Configure `failureRate: 1` in service or mock to throw.

### Accessibility Review

1. Tab through all interactive controls — focus ring must be visible.
2. Activate date inputs with keyboard — Enter key should advance to end field.
3. Press Escape on a date input — focus should blur.
4. Test with a screen reader (VoiceOver / NVDA / JAWS):
   - Page heading announces "Response Time Tracker".
   - Metrics grid announces "Response time metrics" list.
   - Each card announces its label.
   - Entry list announces "Response time entries" list.
   - Each entry announces subject and SLA status.
   - Error state is announced immediately via `role="alert"`.
5. Verify `aria-busy` transitions correctly during loading.
6. Verify all icons have `aria-hidden="true"` and are not announced.

### Keyboard Navigation

1. Tab to Start date field → type a date → press Enter → focus moves to End date.
2. Tab to End date field → press Escape → focus is removed.
3. Tab to Refresh button → press Enter/Space → data reloads.
4. Tab to Retry button (in error state) → press Enter/Space → data reloads.

### State Machine Verification

1. **Initial load**: Loading → Success (or Error).
2. **Error → Retry**: Click retry → Loading → Success (or Error again).
3. **Date range change**: Picking a new range triggers a reload cycle.
