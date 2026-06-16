# Postage Contract

Records sender-authorized token escrow for Stealth messages and tracks whether
the recipient settled or refunded each escrow.

The contract is initialized with one accepted SEP-41/Stellar Asset Contract
asset, a minimum postage amount, a treasury address, and an explicit fee in
basis points. `submit` transfers the full postage amount from the sender into
the contract address. `settle` transfers net postage to the recipient and fee
to treasury. `refund` returns the full escrow to the sender.

## Interface

- `initialize(asset, treasury, minimum, fee_bps)` sets accepted asset and fee policy once.
- `config()` reads the accepted asset, treasury, minimum, and fee policy.
- `minimum()` reads the configured minimum postage.
- `quote(sender_trusted)` returns zero for trusted senders or the minimum.
- `submit(...)` escrows sender-authorized postage for a message.
- `settle(message_id)` lets the recipient accept the postage and releases escrow.
- `refund(message_id)` lets the recipient return escrow to the sender.
- `get(message_id)` reads the current record.

## Settlement Invariants

- Only the configured asset is accepted.
- Fee policy is explicit and bounded to `0..=10000` basis points.
- A message can move from pending to settled or refunded exactly once.
- Balance conservation is tested across sender, recipient, treasury, and contract escrow balances.
