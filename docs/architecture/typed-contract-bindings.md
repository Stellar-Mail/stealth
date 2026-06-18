# Typed Contract Bindings

## Problem

Hand-written Soroban contract calls drift from deployed interfaces over time.
Without a generation step, parameter lists, return types, and error codes are
duplicated between the contract source and the client, producing brittle
integrations and confusing runtime failures.

## Solution

A code generator (`scripts/generate-contract-bindings.mjs`) reads a
`spec.json` artifact committed alongside each Soroban contract and emits a
typed TypeScript client module. The committed output is the source of truth for
the client. CI detects any divergence between the spec and the committed files.

## Artifacts

| Path                                       | Role                                                              |
| ------------------------------------------ | ----------------------------------------------------------------- |
| `contracts/soroban/{name}/spec.json`       | Contract interface definition (structs, enums, errors, functions) |
| `scripts/generate-contract-bindings.mjs`   | Generator — reads spec.json, emits TypeScript                     |
| `src/services/stellar/contracts/{name}.ts` | Generated typed client (do not edit by hand)                      |
| `src/services/stellar/contracts/index.ts`  | Generated barrel re-export                                        |

### Contracts covered

- `policies` — mailbox policy, delegate scope, sender rules and tiers
- `postage` — escrow lifecycle (submit, settle, refund, dispute, expire, reclaim)
- `receipts` — delivery and read receipts

## Generator details

The generator uses `@stellar/stellar-sdk` XDR types to encode each spec entry
as a base64 XDR string and embeds the full `SPEC_ENTRIES` array directly in the
output file. This means the bindings carry their own contract ABI; no runtime
spec fetch is needed.

For each contract the generator emits:

1. **TypeScript interfaces** for every struct in `spec.json`
2. **TypeScript enums** for every enum and error enum
3. A **`SPEC_ENTRIES`** constant (base64 XDR, used by `contract.Spec`)
4. A **`create{Contract}Client`** factory returning a `contract.Client`
5. A **`parse{Contract}Error`** helper mapping numeric codes to the error enum
6. **Typed async wrappers** for every function, with explicit parameter and
   return types

### spec.json type grammar

```
void | bool | u32 | i32 | u64 | i64 | u128 | i128 | address | bytes32 | string
option:<inner>
result:<ok>:<error_udt_name>
udt:<Name>
```

## CI staleness check

The CI client job runs the generator and fails if the working tree has a diff:

```yaml
- run: node scripts/generate-contract-bindings.mjs
- run: |
    git diff --exit-code src/services/stellar/contracts/ || \
      (echo "Contract bindings are stale. Run 'npm run generate:bindings' and commit the result." && exit 1)
```

A contract interface change cannot merge without updated bindings.

## Regenerating bindings

```bash
npm run generate:bindings
# then commit src/services/stellar/contracts/
```

## CI failure: stale bindings (fixed 2026-06-18)

### Root cause

The generator's emitter was updated (formatting of `createClient` factory,
`parseError` helper, typed wrappers, and `SPEC_ENTRIES` array trailing-comma
removal) but the previously-committed output files were not regenerated before
merging. On the next CI run the staleness check caught the divergence.

Specific diffs:

- `SPEC_ENTRIES` array: trailing comma removed from last element
- `create{X}Client`: `new contract.Client(spec, opts)` split to multi-line with
  `Spec` and options object as separate arguments
- `parse{X}Error`: signature broken to separate `code: number` onto its own line
- Typed wrappers: parameters collapsed onto fewer lines; inline object args for
  calls with many inputs

### Fix

Run the generator against the committed `spec.json` files and commit the
regenerated output:

```bash
node scripts/generate-contract-bindings.mjs
git add src/services/stellar/contracts/
git commit -m "chore: sync contract bindings to generator output"
```

## Error mapping to UI states

Each generated `parse{Contract}Error(code)` returns a typed enum variant or
`undefined`. UI layers should map these variants to actionable states:

| Contract | Error                  | UI state                                                  |
| -------- | ---------------------- | --------------------------------------------------------- |
| Policies | `InvalidPostage`       | "Postage amount is invalid"                               |
| Policies | `UnauthorizedDelegate` | "You are not authorized to act on behalf of this mailbox" |
| Postage  | `DuplicateMessage`     | "Message already has postage attached"                    |
| Postage  | `PostageNotFound`      | "No postage record found for this message"                |
| Postage  | `AlreadyResolved`      | "Postage has already been settled or refunded"            |
| Postage  | `NotExpired`           | "Postage window has not expired yet"                      |
| Postage  | `DisputeUnavailable`   | "Dispute window has passed"                               |
| Receipts | `DuplicateReceipt`     | "Delivery already recorded for this message"              |
| Receipts | `ReceiptNotFound`      | "No delivery record found"                                |
| Receipts | `AlreadyRead`          | "Message already marked as read"                          |
| Receipts | `CommitmentMismatch`   | "Payload hash does not match the delivery commitment"     |
