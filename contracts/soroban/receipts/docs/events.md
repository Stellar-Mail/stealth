# Receipts Contract — Event Schema

The receipts contract emits two events. Off-chain consumers (relays, indexers,
clients) filter and decode them straight from the ledger, so their wire format
is a public contract: topic layout and data shape are covered by the
`event_schema` tests in `src/lib.rs`, and any change fails CI before it can
break integrators.

Both events are defined with `#[contractevent(data_format = "single-value")]`
in `src/lib.rs`.

## `delivered`

Emitted exactly once per message, when `delivered(...)` persists a new
delivery receipt.

| Part  | Position | Type            | Value                                                           |
| ----- | -------- | --------------- | --------------------------------------------------------------- |
| Topic | 0        | `ScVal::Symbol` | `"delivered"` (derived from the `Delivered` struct name)        |
| Topic | 1        | `ScVal::Bytes`  | `message_id` (32 bytes)                                         |
| Data  | —        | `ScVal::Map`    | The `Receipt` struct as a bare value (single-value data format) |

## `read`

Emitted at most once per message, when `read(...)` records the
recipient-authorized read timestamp. Same topic shape as `delivered`:

| Part  | Position | Type            | Value                                    |
| ----- | -------- | --------------- | ---------------------------------------- |
| Topic | 0        | `ScVal::Symbol` | `"read"`                                 |
| Topic | 1        | `ScVal::Bytes`  | `message_id` (32 bytes)                  |
| Data  | —        | `ScVal::Map`    | The `Receipt` struct, with `read_at` set |

## Receipt data payload

The data payload is the `Receipt` struct encoded as an `ScMap`. Keys are
symbols named after the struct fields, in canonical `SCMap` order
(alphabetical):

| Key                | Type          | Notes                                                             |
| ------------------ | ------------- | ----------------------------------------------------------------- |
| `delivered_at`     | `u64`         | Ledger timestamp fixed at delivery; never changes afterward       |
| `message_id`       | `Bytes` (32)  | Duplicates topic 1 so the payload is self-contained               |
| `payload_hash`     | `Bytes` (32)  | Immutable payload commitment                                      |
| `protocol_version` | `u32`         | Immutable protocol version committed at delivery                  |
| `read_at`          | `Option<u64>` | `Void` in `delivered` events; the read timestamp in `read` events |
| `recipient`        | `Address`     | The only party able to trigger the `read` event                   |
| `sender`           | `Address`     | The party that authorized delivery                                |

## Consumer guarantees

- **Filtering**: subscribe by contract address plus topic 0 (`"delivered"` /
  `"read"`), and narrow to a single message with topic 1 — no data decoding
  required for routing.
- **Ordering**: for any `message_id`, `delivered` precedes `read`; each is
  emitted at most once. Duplicate or conflicting submissions fail before the
  publish, so consumers never see a second `delivered` for the same id.
- **Failure paths emit nothing**: rejected calls (bad auth, guard rejection,
  duplicate, unknown message) publish no events and write no state. An
  observed event always corresponds to persisted state.
- **Consistency**: the event payload equals the stored receipt at emission
  time. A `read` event always carries a non-void `read_at`, so consumers never
  observe a read whose receipt looks undelivered.
- **Stability**: field additions, topic reordering, renames, or a data-format
  change are schema breaks. The `event_schema` tests pin the current layout;
  changing it requires a deliberate, versioned migration for consumers.
