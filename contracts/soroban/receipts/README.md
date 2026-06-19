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
