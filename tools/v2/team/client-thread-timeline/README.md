# Client Thread Timeline

This folder is the isolated workspace for the Client Thread Timeline tool — a
presentation-free service that groups raw mail messages into a per-client,
per-thread chronological timeline.

## Ownership Boundary

All work for this tool must stay inside:
`tools/v2/team/client-thread-timeline/`

Do not wire this tool into the main app, routing, inbox architecture, wallet
core, Stellar core, database schema, or existing design system unless a future
integration issue explicitly allows it.

See `specs.md` for the architecture contract, issue categories, and contributor
expectations.

## Non-UI execution contract

The timeline exposes a presentation-free execution contract so it can run as a
backend service, independent of any UI.

- `types.ts` — domain types: `TimelineMessage`, `TimelineThread`,
  `ClientTimeline`, and the `BuildTimelineInput` / `GetThreadInput` inputs.
- `contract.ts` — the typed contract: `TimelineOperation`,
  `TimelineContractOutput`, the `TimelineResult<T>` discriminated union, and
  explicit `TimelineErrorCode` values. Also holds the pure helpers
  `buildClientTimeline` / `getClientThread`.
- `services/timeline.service.ts` — `createTimelineContract()` adapts the pure
  helpers into a `TimelineContract` whose `execute(...)` returns a typed
  success/error result instead of throwing.
- `fixtures.ts` — deterministic sample messages (two clients, two threads,
  intentionally unsorted).
- `tests/contract.test.ts` — vitest coverage of the contract and its
  happy/edge/error paths.

Usage:

```ts
import { createTimelineContract } from ".";

const contract = createTimelineContract();
const res = contract.execute({
  operation: "buildTimeline",
  input: { clientId: "client-acme", messages },
});
if (res.ok && res.value.operation === "buildTimeline") {
  // res.value.timeline.threads is ordered by time, grouped by thread
} else {
  // res.error is a TimelineErrorCode (e.g. NotFound)
}
```
