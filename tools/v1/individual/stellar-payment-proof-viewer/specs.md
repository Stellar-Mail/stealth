# Stellar Payment Proof Viewer

Review Stellar payment proof data in a V1 individual workspace.

## Scope

- Release tier: V1
- Audience: individual
- Folder ownership: `tools/v1/individual/stellar-payment-proof-viewer/`

This is a self-contained tooling workspace. Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, or design system unless a future integration issue explicitly allows it.

## Purpose

Help users inspect a claimed Stellar payment proof without implying that the app
has independently verified settlement unless a future network-checking feature
does so.

## Functional Contract

- Input: a parsed or pasted proof object from an email, attachment, or manual
  entry.
- Output: a normalized review model with visible fields and validation status.
- Proof fields may include:
  - `transactionHash`
  - `sourceAccount`
  - `destinationAccount`
  - `assetCode`
  - `issuer`
  - `amount`
  - `memo`
  - `ledger`
  - `timestamp`
  - `claimSource`
- Missing optional fields must be shown as unknown, not fabricated.
- Conflicting fields should be flagged for manual review.

## Verification Language

- `provided`: user or email supplied the value.
- `format-valid`: the field has a plausible Stellar format.
- `network-verified`: reserved for future authoritative lookup.
- `conflict`: two supplied values disagree.
- `unsupported`: the proof uses an unsupported field or asset format.

## Required Issue Categories

- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation

## UI And Accessibility Expectations

- Long hashes and account IDs must be copyable in full.
- Truncation must preserve enough prefix and suffix for visual comparison.
- Status badges must include text labels, not color-only meaning.
- Error and warning states must be reachable by keyboard and screen readers.

## Security And Performance Expectations

- Never initiate payment, signing, refund, or wallet connection.
- Do not treat a pasted proof as trusted network evidence.
- Avoid embedding real personal payment addresses in fixtures.
- Parsing should be deterministic and bounded for large pasted messages.

## Testing Expectations

See:

- `docs/test-plan.md`
- `docs/fixtures.md`
