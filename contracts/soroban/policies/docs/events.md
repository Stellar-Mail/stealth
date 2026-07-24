# Policies Contract — Event Schema

The policies contract emits four mutation events. Their topic order and data
encoding are part of the public contract for ledger indexers, relays, and
clients. The `event_schema` tests in `src/lib.rs` pin the layouts documented
below.

All event names are short Soroban symbols. Addresses are native Soroban
`Address` values. Tuple payloads use Soroban tuple/vector encoding, while
contract structs and enums use their normal `#[contracttype]` encoding.

## Events

| Event      | Topics, in order                  | Data                                         | Emitted by                              |
| ---------- | --------------------------------- | -------------------------------------------- | --------------------------------------- |
| `policy`   | `"policy"`, `owner`               | `VersionedMailboxPolicy { policy, version }` | `set_policy`, `set_policy_as`           |
| `delegate` | `"delegate"`, `owner`, `delegate` | `DelegateScope`                              | `set_delegate`                          |
| `sender`   | `"sender"`, `owner`, `sender`     | `(SenderRule, u32 version)`                  | `set_sender_rule`, `set_sender_rule_as` |
| `tier`     | `"tier"`, `owner`, `sender`       | `(i128 minimum_postage, u32 version)`        | `set_sender_tier`, `set_sender_tier_as` |

The public wrapper and its corresponding `*_as` function produce the same
event. The authorized actor is deliberately not included in the schema; the
ledger transaction authorization tree is the source for actor attribution.

## Payload definitions

### `policy`

`VersionedMailboxPolicy` contains:

| Field     | Type            | Meaning                                       |
| --------- | --------------- | --------------------------------------------- |
| `policy`  | `MailboxPolicy` | The complete policy persisted by the mutation |
| `version` | `u32`           | The owner's policy version after the mutation |

`MailboxPolicy` contains `allow_unknown: bool`, `require_verified: bool`,
`require_receipt: bool`, and `minimum_postage: i128`.

### `delegate`

The data is the requested `DelegateScope`, containing `can_set_policy: bool`
and `can_set_senders: bool`. When both values are false, the stored delegation
is removed and the event records that revocation. Delegate mutations do not
increment the owner's policy version.

### `sender`

The first data tuple item is `SenderRule`: `Default`, `Allow`, or `Block`.
`Default` records that the explicit rule was cleared. The second item is the
owner's policy version after the mutation. Setting a rule also removes any
sender tier.

### `tier`

The first data tuple item is the non-negative sender-specific minimum postage.
The second item is the owner's policy version after the mutation. Setting a
tier makes `Default` the effective stored sender rule.

## Consumer guarantees

- Subscribe by contract address and topic 0, then use the indexed owner and
  sender/delegate address topics for routing without decoding event data.
- `policy`, `sender`, and `tier` carry the post-mutation version. Versions are
  monotonically incremented per owner across those three event types.
  `delegate` is intentionally unversioned and does not change this counter.
- An emitted event corresponds to state written by that invocation. Validation
  or authorization failures emit no event and do not increment the version.
- Events describe mutations, including idempotent requests; they are not
  deduplicated state-change notifications.
- Topic reordering, renaming an event, changing a payload type, or changing
  tuple/struct field layout is a schema break. Such a change requires a
  deliberate versioned migration for off-chain consumers.
