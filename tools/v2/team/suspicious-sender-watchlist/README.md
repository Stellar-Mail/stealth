# Suspicious Sender Watchlist

This folder is the isolated workspace for the Suspicious Sender Watchlist tool.

## Ownership Boundary

All work for this tool must stay inside:
`tools/v2/team/suspicious-sender-watchlist/`

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

See `specs.md` for the architecture contract, issue categories, and contributor expectations.

## Non-UI execution contract

The watchlist exposes a presentation-free execution contract so it can run as a
backend service, independent of any UI.

- `contract.ts` — the typed contract: `WatchlistContractInput`,
  `WatchlistContractOutput`, and the `WatchlistResult<T>` discriminated union
  plus explicit `WatchlistErrorCode` values.
- `services/execution-contract.ts` — `createWatchlistContract(service)`
  adapts the existing `createWatchlistService` into a `WatchlistContract`
  whose `execute(...)` returns a typed success/error result instead of throwing.
- `fixtures/contract.fixtures.ts` — representative input/output samples.
- `tests/contract.test.ts` — vitest coverage of the contract and its
  happy/edge/error paths.

Usage:

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
  // res.error is a WatchlistErrorCode (e.g. EntryNotFound, BackendFailure)
}
```
