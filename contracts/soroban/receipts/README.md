# Receipts Contract

Creates authenticated delivery and read-receipt state for an encrypted payload
commitment.

The sender authorizes the delivery record, which binds the message ID, payload
hash, protocol version, sender, recipient, and delivery timestamp. The payload
commitment is immutable: duplicate message IDs cannot overwrite existing state,
and a duplicate ID with a different commitment fails. Only the recipient can add
the read timestamp. Both transitions emit events for relays and clients.

## Interface

- `delivered(message_id, payload_hash, protocol_version, sender, recipient)` creates a delivery receipt.
- `read(message_id)` adds the recipient-authorized read timestamp.
- `get(message_id)` reads the receipt.
- `configure_guard(guard)` binds the lifecycle guard contract once.
- `guard()` returns the configured guard address.

## Events

`delivered` and `read` are emitted once per transition with the message id as
a topic and the full receipt as the data payload. The complete wire schema —
topic layout, data encoding, ordering, and stability guarantees for off-chain
consumers — is documented in `docs/events.md` and pinned by the
`event_schema` tests in `src/lib.rs`.

## Authorization boundaries

- `delivered` requires the sender's authorization, and the signature is bound
  to the exact invocation arguments: a relay holding a signature for one
  payload commitment cannot replay it with a different message ID, payload
  hash, protocol version, or party. Authorization by the recipient (or anyone
  other than `sender`) is rejected.
- `read` requires authorization from the recipient stored in the receipt, not
  from a caller-supplied address. The sender cannot forge a read
  acknowledgement, and a failed authorization leaves `read_at` unset.
- `get` is public and requires no authorization; receipt existence is not
  treated as a secret. `read` on an unknown message ID fails with
  `ReceiptNotFound` before any authorization is required.
- `configure_guard` is a one-shot, first-write-wins binding with no address
  authorization of its own: deployers must configure the guard atomically with
  deployment (e.g. in the same transaction). Any later call fails with
  `GuardAlreadyConfigured`, so the guard address is immutable once set.
- Both `delivered` and `read` fail with `GuardNotConfigured` until the guard
  is bound, and guard rejections surface as `LifecycleRejected`; no receipt
  state is written on any failure path.

These boundaries are pinned by the authorization tests in `src/lib.rs`
(`delivered_fails_*`, `read_fails_*`, `configure_guard_is_first_write_wins_and_immutable`,
`authorization_tree_binds_delivery_to_sender_and_read_to_recipient`).
