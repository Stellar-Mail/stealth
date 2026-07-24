# Response Time Tracker

Track response speed for team emails.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v2/team/response-time-tracker/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet
core, Stellar core, database schema, or existing design system unless a future
integration issue explicitly allows it.

## Tool Workflow

1. Select a date range to filter response time entries.
2. View aggregate metrics: average, median, fastest, slowest response times.
3. View SLA compliance percentage and status breakdown (met / missed / breached).
4. Browse individual response time entries sorted chronologically.
5. Refresh data to pull in the latest entries.

## States

The tool handles four states for both metrics and entry list views:

| State   | Description                                       |
| ------- | ------------------------------------------------- |
| Loading | Skeleton placeholders while data is being fetched |
| Empty   | No response time entries found for the range      |
| Error   | Failed to fetch data, with retry button           |
| Success | Data loaded and rendered                          |

## Accessibility

- All interactive controls have visible labels or `aria-label`.
- Date inputs are connected to `<label>` elements via `htmlFor`/`id`.
- The refresh button announces its purpose to screen readers.
- Status regions use `role="status"`, `role="alert"`, or `aria-live` for dynamic updates.
- Loading regions use `aria-busy="true"`.
- Lists use `role="list"` / `role="listitem"` for correct screen reader semantics.
- Focus is managed via `ref` and keyboard handlers on date inputs (Enter advances to end, Escape blurs).
- Error states use `role="alert"` with `aria-live="assertive"` for immediate notification.

## Visual Style

The tool uses a self-contained set of Tailwind CSS v4 classes that match the
project's dark theme design language:

- Borders: `border-border/30` / `border-border/40`
- Surfaces: `bg-white/5`, `bg-white/[0.03]`, `bg-white/[0.02]`, `bg-white/[0.04]`
- Backdrop: `backdrop-blur-sm`
- Text: `text-foreground`, `text-muted-foreground`
- Accents: `text-green-500` (met), `text-amber-500` (missed), `text-red-500` (breached)
- Rounded corners: `rounded-2xl`, `rounded-xl`, `rounded-lg`
- Font sizes use Tailwind scale (`text-xs`, `text-sm`, `text-lg`, `text-xl`, `text-3xl`)

No shared design system components or CSS files are imported. The tool depends
only on the project's Tailwind theme and CSS custom properties defined in
`src/styles.css`, which are available globally at build time.

## Fixtures

- `fixtures/sample-response-times.json` — 7 sample entries with varying SLA statuses
- `fixtures/team-members.json` — 3 team members

The fixture data is intentionally small so OSS contributors can reason about
the expected behavior without running the main app. The service layer defaults
to loading fixture data with an 800 ms simulated delay.

## Non-UI Execution Contract

`runResponseTimeQuery` (exported from `index.ts`, defined in
`services/execution-contract.ts`) is a stable, backend-facing entry point that
runs a full query (entries, metrics, team members) and resolves with a typed
`ResponseTimeQueryResult` — it never throws. See
`docs/execution-contract.md` for the typed input/output contract and error
codes, and `fixtures/execution-contract-cases.json` for the success/failure
cases it is tested against.

## Documentation Map

- `specs.md` — Local product contract, boundaries, and required categories.
- `docs/test-plan.md` — Manual and automated review steps.
- `docs/review-notes.md` — What was validated and what remains out of scope.
- `docs/execution-contract.md` — Typed non-UI input/output contract and error codes.

## Tests

Run the local tests from the repository root:

```bash
node --test tools/v2/team/response-time-tracker/tests/response-time.test.mjs
node --test tools/v2/team/response-time-tracker/tests/execution-contract.test.mjs
```

The tests use Node's built-in test runner. `response-time.test.mjs` validates
the response-time service logic (metrics calculation, date filtering, error
handling); `execution-contract.test.mjs` validates the non-UI execution
contract's success and failure cases against
`fixtures/execution-contract-cases.json`.

## Known Limitations

- This contribution does not wire the tool into the main app shell or routing.
- Data comes from folder-local fixtures; a future integration issue should
  connect to live inbox data.
- Authorization, database writes, and notification side effects remain out of
  scope for this isolated V2 folder.
