# Postage Contract — Storage Layout & Migration Notes

The postage contract uses two Soroban storage spaces, keyed by the `DataKey` enum
defined in `src/lib.rs`.

| Variant                 | Storage space | Written by                     | Read by                                              |
| ----------------------- | ------------- | ------------------------------ | ---------------------------------------------------- |
| `DataKey::Config`       | Instance      | `initialize` (once)            | `config`, `submit`, `quote`, `minimum`               |
| `DataKey::Guard`        | Instance      | `configure_guard` (once)       | `guard`, `verify_guard` (internal), all state mutators |
| `DataKey::Postage(id)`  | Persistent    | `submit`, then every state mutator | `get`, `submit`, `expire`, `settle`, `refund`, `dispute`, `reclaim` |

`Config` and `Guard` are single, contract-wide configuration values set at most once
(`AlreadyInitialized` on a second call). `Postage(id)` is
keyed by the 32-byte message id and holds the full [`Postage`] record; `submit` creates
it and every subsequent state mutator (`expire`, `settle`, `refund`, `dispute`,
`reclaim`) updates fields in place — the key itself never changes shape or moves
storage space.

## How `DataKey` is encoded

Soroban's `#[contracttype]` derive encodes each enum variant as a host vector whose
first element is a `Symbol` built from the variant's Rust _name_ (`"Config"`,
`"Guard"`, `"Postage"`), followed by any tuple fields. Decoding looks up a
previously-written key by that name among the enum's _current_ variants — the
numeric declaration order plays no part in the encoding. Concretely, this means:

- **Renaming or removing a variant that has ever written storage is unsafe.** The
  encoded `Symbol` changes (or disappears), so any key written under the old name
  becomes permanently undecodable and its ledger entry is orphaned.
- **Changing a variant's tuple field types is unsafe** for the same reason: the
  encoded shape no longer matches what was previously persisted.
- **Reordering variants is safe** on its own, since decoding is name-based, not
  positional. New variants should still be appended at the end, both to keep
  declaration order matching historical introduction order, and to stay consistent
  with the convention used by the other Soroban contracts in this workspace.

## Migrating a key's structure

If a key's structure ever needs to change (e.g. adding a field to the `Postage`
key, or introducing a tiered key), do not repurpose the existing variant. Instead:

1. Leave the existing variant (`Postage(BytesN<32>)`) in place so already-written
   entries stay readable under it.
2. Add a new variant (e.g. `PostageV2(BytesN<32>, u32)`) for the new shape.
3. Give read paths an explicit fallback: try the new key first, and if absent, fall
   back to the old key (and optionally backfill the new key on read or via a
   dedicated migration entry point).
4. Document the coexistence period and removal plan for the old variant here.

No such migration is in progress today; this document exists so the first one
starts from an explicit, reviewed plan rather than an ad hoc rename.

## Test coverage

The `storage_keys` test module in `src/lib.rs` pins the encoded discriminant name
for each `DataKey` variant (`config_key_discriminant_is_pinned`,
`guard_key_discriminant_is_pinned`, `postage_key_discriminant_is_pinned`) so an
accidental rename fails CI before it can reach production, and verifies that
distinct message ids never collide in persistent storage
(`distinct_message_ids_produce_distinct_postage_keys`).
