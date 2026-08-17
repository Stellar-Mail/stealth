# Wallet Address Detector

Detect wallet-address-shaped tokens in email content and expose them as
reviewable metadata for a V1 individual tool.

## Scope

- Release tier: V1
- Audience: individual
- Folder ownership: `tools/v1/individual/wallet-address-detector/`

This is a self-contained tooling workspace. Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, or design system unless a future integration issue explicitly allows it.

## Purpose

Help a user notice possible payment or wallet addresses in an email without
turning detection into an automatic payment action.

## Functional Contract

- Input: normalized email subject/body text and optional message metadata.
- Output: an ordered list of detections.
- Each detection should include:
  - `address`
  - `networkHint`
  - `confidence`
  - `startIndex` and `endIndex`
  - `sourceExcerpt`
  - optional `riskHints`
- Detection must be deterministic for the same input.
- Detection must not mutate the source message.

## Supported Detection Families

- Stellar public keys beginning with `G`.
- Stellar contract IDs beginning with `C`.
- EVM-style `0x` addresses.
- Solana-like base58 public keys.

## Required Issue Categories

- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation

## UI And Accessibility Expectations

- Detected addresses should be displayed as selectable text.
- Long addresses should be visually truncated only when the full value remains
  copyable and reviewable.
- Network hints and confidence should be text-visible, not color-only.
- Any copy/open action should be explicit and keyboard accessible.

## Security And Performance Expectations

- No automatic transfer, signing, wallet connection, or clipboard write.
- No external lookup is required for baseline detection.
- Regex or parser logic should be bounded to avoid catastrophic backtracking.
- Fixtures must use synthetic data rather than real payment addresses.

## Testing Expectations

See:

- `docs/test-plan.md`
- `docs/fixtures.md`
