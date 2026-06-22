# Stellar Payment Proof Viewer

V1 individual tool workspace for reviewing Stellar payment proof details from
email content, screenshots, or pasted transaction references.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v1/individual/stellar-payment-proof-viewer/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

## Intended Use

- Display a submitted Stellar payment proof in a readable review format.
- Separate user-provided proof data from any future network-verified status.
- Highlight sender, recipient, asset, amount, memo, ledger, transaction hash,
  and timestamp when those values are present.
- Keep the user in control before copying, opening, or trusting any payment
  reference.

## Non-Goals

- Do not initiate, sign, refund, or request payments.
- Do not mark a proof as verified unless a future integration explicitly checks
  an authoritative Stellar data source.
- Do not store personal payment details outside this folder.

## Testing Focus

Use `docs/fixtures.md` and `docs/test-plan.md` to validate complete proofs,
partial proofs, conflicting fields, suspicious memo text, unsupported assets,
and display/accessibility behavior.
