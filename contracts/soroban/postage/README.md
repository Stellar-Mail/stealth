# Postage Contract

Records sender-authorized token escrow for Stealth messages and tracks whether
each escrow is pending, expired, disputed, settled, refunded, or reclaimed.

The contract is initialized with one accepted SEP-41/Stellar Asset Contract
asset, a minimum postage amount, a treasury address, and an explicit fee in
basis points, a fixed expiry duration, and an optional dispute duration.
`submit` transfers the full postage amount from the sender into the contract
address and fixes the absolute expiry timestamps on the record. `settle`
transfers net postage to the recipient and fee to treasury. `refund` returns
the full escrow to the sender. `reclaim` lets the sender recover unresolved
escrow after expiry and any dispute window.

## Interface

- `initialize(asset, treasury, minimum, fee_bps, expiry_seconds, dispute_seconds)` sets accepted asset, fee, expiry, and dispute policy once.
- `config()` reads the accepted asset, treasury, minimum, and fee policy.
- `minimum()` reads the configured minimum postage.
- `quote(sender_trusted)` returns zero for trusted senders or the minimum.
- `submit(...)` escrows sender-authorized postage for a message.
- `expire(message_id)` marks unresolved postage expired at its fixed expiry boundary.
- `settle(message_id)` lets the recipient accept the postage and releases escrow.
- `refund(message_id)` lets the recipient return escrow to the sender.
- `dispute(message_id)` lets the recipient move expired pending postage into the bounded dispute state when dispute seconds are configured.
- `reclaim(message_id)` lets the sender reclaim unresolved postage at the fixed reclaim boundary.
- `get(message_id)` reads the current record.

## Settlement Invariants

- Only the configured asset is accepted.
- Fee policy is explicit and bounded to `0..=10000` basis points.
- Expiry and dispute deadlines are fixed at submission.
- Reclaim fails before the fixed reclaim boundary.
- A message can move from pending, expired, or disputed to exactly one terminal state: settled, refunded, or reclaimed.
- Terminal states cannot transition.
- Balance conservation is tested across sender, recipient, treasury, and contract escrow balances.
