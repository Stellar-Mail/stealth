# Execution Contract — Response Time Tracker

This document defines the non-UI, backend-facing execution contract for the
Response Time Tracker tool: a stable entry point that can be called from a
script, a test, or a future server context without importing React or any
component from `components/`.

## Entry point

```ts
import { runResponseTimeQuery } from "tools/v2/team/response-time-tracker";

const result = await runResponseTimeQuery(
  { range: { start: "2026-06-10", end: "2026-06-12" } }, // ResponseTimeQueryInput, optional
  { simulateDelay: false }, // ResponseTimeServiceConfig, optional
);
```

`runResponseTimeQuery` is defined in `services/execution-contract.ts` and
re-exported from the tool's `index.ts` barrel. It never throws — every
outcome, success or failure, is represented in the returned
`ResponseTimeQueryResult`.

## Typed input

```typescript
interface ResponseTimeQueryInput {
  range?: DateRange; // { start: string; end: string } — ISO 8601 dates (YYYY-MM-DD)
}
```

Omitting `range` queries the full dataset. The optional second argument,
`ResponseTimeServiceConfig` (defined in `services/response-time-service.ts`),
controls simulated latency and failure injection and is intended for tests and
fixtures, not production callers.

## Typed output

```typescript
type ResponseTimeQueryResult =
  | { ok: true; data: ResponseTimeQueryData }
  | { ok: false; error: ResponseTimeQueryError };

interface ResponseTimeQueryData {
  entries: ResponseTimeEntry[];
  metrics: ResponseTimeMetrics;
  teamMembers: TeamMember[];
}

interface ResponseTimeQueryError {
  code: ResponseTimeErrorCode;
  message: string;
}
```

`data` and `error` are mutually exclusive: a result with `ok: true` always has
`data` and never `error`, and vice versa. Callers should discriminate on `ok`,
not on the presence of a particular key.

## Error codes

| Code                 | Meaning                                                                          | When it is returned                                      |
| -------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `INVALID_DATE_RANGE` | `range.start` is after `range.end`, or either bound fails to parse as a date.    | Before any fetch is attempted — no service call is made. |
| `FETCH_FAILED`       | The underlying data fetch rejected (e.g. a simulated failure via `failureRate`). | After the service call, when `Promise.all(...)` rejects. |

Both codes are exhaustive for the current contract: any call either resolves
successfully or resolves with one of these two codes. Adding a new failure
mode should extend `ResponseTimeErrorCode` rather than reuse an existing code
for an unrelated condition.

## Fixtures

`fixtures/execution-contract-cases.json` enumerates named success and failure
cases (input, optional service config, and expected outcome) used by
`tests/execution-contract.test.mjs`:

- **`successCases`**: no range (full dataset), a narrowing single-day range,
  and a range that matches nothing (an empty result set is still a success,
  not an error).
- **`failureCases`**: an inverted range, an unparseable date bound, and a
  simulated service failure (`failureRate: 1`) — covering both the
  input-validation error path and the fetch-failure error path.

## Relationship to the UI layer

`useResponseTimes` (in `hooks/`) is the UI-facing consumer of the service
layer and predates this contract; it manages `FetchState` for three
independently-loading slices (entries, metrics, team members) to drive
loading/empty/error/success rendering per `specs.md`. `runResponseTimeQuery`
does not replace that hook — it is a separate, coarser-grained entry point for
callers that want one awaited call with a single typed result and don't need
per-slice loading states. Neither the hook nor any component was changed by
this contract; no styling or layout files are part of this change.
