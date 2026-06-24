# Wallet Address Detector

V1 individual tool workspace for detecting wallet addresses in email content and
turning the findings into reviewable, non-custodial signals.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v1/individual/wallet-address-detector/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

## Intended Use

- Scan plain-text or normalized email bodies for wallet-address-shaped tokens.
- Prefer conservative matches that can be reviewed before any user action.
- Return the detected address, network hint, source excerpt, and confidence level.
- Preserve the original message text; detection must not mutate or redact content.

## Address Coverage

The first pass should prioritize:

- Stellar public keys beginning with `G`.
- Stellar contract IDs beginning with `C`.
- EVM-style `0x` addresses.
- Solana-style base58 public keys.

Network inference is a hint, not a payment authorization. The detector must not
send, request, sign, or prepare transactions.

## Local Testing Focus

Use the fixtures in `docs/fixtures.md` to cover valid addresses, near misses,
multiple addresses in one email, punctuation-adjacent addresses, and malicious
copy that tries to hide or confuse a destination address.

See `docs/test-plan.md` for the manual and automated validation checklist.
