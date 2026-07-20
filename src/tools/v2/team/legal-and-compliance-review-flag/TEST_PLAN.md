# Legal and Compliance Review Flag — Test Plan

> **Status:** code not yet present on `main` (the non-UI execution contract for
> this tool has not landed). Per the issue ("documented test plan if code is not
> ready"), this folder carries a concrete test plan + fixtures so the behavior
> can be validated independently as soon as the contract lands.

## Scope

Isolated V2 "team" tool. Everything stays inside this folder; no app/routing/
wallet/Stellar core changes.

## Expected behavior (contract under test)

A "review flag" lifecycle over a document/thread, with a non-UI service
entry point. Based on the tool name and the sibling tools' contracts:

| Operation       | Input                                      | Expected result                                                              |
| --------------- | ------------------------------------------ | ---------------------------------------------------------------------------- |
| `raise`         | `{ targetId, raisedBy, reason, severity }` | A flag is created with status `OPEN`, a monotonic `flagId`, `raisedAt` set.  |
| `resolve`       | `{ flagId, resolvedBy, resolution }`       | Status transitions `OPEN` → `RESOLVED`; records `resolvedAt` + `resolvedBy`. |
| `list`          | `{ targetId? }`                            | Returns flags, optionally filtered by target; newest first.                  |
| duplicate raise | same `targetId` already `OPEN`             | rejected (`error: "already flagged"`) — no second open flag.                 |
| resolve absent  | `flagId` does not exist                    | rejected (`error: "flag not found"`).                                        |
| list filter     | `targetId` with no flags                   | returns empty list (no error).                                               |
| immutability    | any op                                     | input objects are not mutated; operations return new state.                  |

## Fixtures (`fixtures.ts`)

- `mockOpenFlag` — a sample `OPEN` flag.
- `mockResolvedFlag` — a sample `RESOLVED` flag.
- `mockRaiseInput` / `mockResolveInput` — representative service inputs.
- `mockFlagList` — a small list spanning `OPEN` and `RESOLVED`.

## Planned tests (to add once `engine.ts` lands)

File: `__tests__/reviewFlag.test.ts`

- `raise` creates an `OPEN` flag with monotonic id + timestamp.
- `resolve` moves `OPEN` → `RESOLVED` and records resolver + resolution.
- duplicate `raise` on an already-`OPEN` target is rejected.
- `resolve` of a missing `flagId` is rejected.
- `list` filters by `targetId` and returns empty when none exist.
- operations are immutable (no mutation of inputs).

## How to run (once code exists)

```sh
npm install
npx vitest run src/tools/v2/team/legal-and-compliance-review-flag
```

## Known limitations

- No persistence/auth layer yet; this is the isolated logic contract.
- Severity levels and resolution vocabulary are placeholders until the
  execution contract is merged.
