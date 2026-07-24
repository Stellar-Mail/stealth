# Client Priority Scoring

This folder is the isolated workspace for the Client Priority Scoring tool — a
presentation-free service that ranks clients by weighted importance signals.

## Ownership Boundary

All work for this tool must stay inside:
`tools/v2/team/client-priority-scoring/`

Do not wire this tool into the main app, routing, inbox architecture, wallet
core, Stellar core, or design system unless a future integration issue
explicitly allows it.

See `specs.md` for the architecture contract, issue categories, and contributor
expectations.

## Non-UI execution contract

The scoring logic exposes a presentation-free execution contract so it can run
as a backend service, independent of any UI.

- `types.ts` — domain types: `ClientSignal`, `ClientForScoring`, `ScoredClient`,
  `ScoreClientsInput`, `PriorityOrder`.
- `contract.ts` — the typed `PriorityOperation` / `PriorityContractOutput`, the
  `PriorityResult<T>` discriminated union, explicit `PriorityErrorCode` values,
  and the pure `scoreClients` reducer plus `validateClient` / `validateScoreInput`.
- `services/client-priority.service.ts` — `createPriorityContract()` adapts the
  pure reducer into a `PriorityContract` whose `execute(...)` returns typed
  success/error results instead of throwing.
- `fixtures.ts` — deterministic sample clients.
- `tests/contract.test.ts` — vitest coverage of weighted scoring, priority
  bands, ordering, empty input, and invalid-signal error paths.

Usage:

```ts
import { createPriorityContract } from ".";

const contract = createPriorityContract();
const res = contract.execute({
  operation: "score",
  input: { clients, highThreshold: 10, lowThreshold: 3 },
});
if (res.ok && res.value.operation === "score") {
  // res.value.ranked is sorted by score, each with a priority band
} else {
  // res.error is a PriorityErrorCode
}
```
