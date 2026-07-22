# Wallet Address Detector Test Plan

## Goals

- Verify that the detector finds wallet-address-shaped tokens without changing
  email content.
- Confirm network hints are conservative and reviewable.
- Guard against false positives in order numbers, URLs, tracking IDs, and code.
- Keep all implementation and documentation inside the V1 individual tool folder.

## Automated Cases

1. Stellar public key detection

   - Given an email containing one `G...` public key with valid length.
   - Expect one detection with `networkHint: "stellar-public-key"` and a source
     excerpt that includes the full token.

2. Stellar contract ID detection

   - Given an email containing one `C...` contract ID.
   - Expect one detection with `networkHint: "stellar-contract"` and no payment
     action side effects.

3. EVM address detection

   - Given an email containing a checksummed or lowercase `0x` address.
   - Expect one detection with `networkHint: "evm"` and confidence below any
     future validated-checksum result unless checksum validation is implemented.

4. Solana-style base58 detection

   - Given a sentence with one base58 token in the accepted length range.
   - Expect one detection with `networkHint: "solana-like"` and conservative
     confidence.

5. Punctuation boundaries

   - Given addresses followed by `.`, `,`, `)`, `]`, or a newline.
   - Expect punctuation to be excluded from the detected address value.

6. Multiple detections

   - Given one email containing Stellar and EVM addresses.
   - Expect stable ordering by first appearance and no duplicate records.

7. False positive filtering

   - Given UUIDs, invoice IDs, URLs, phone numbers, and short hex strings.
   - Expect zero wallet detections.

8. Suspicious copy handling
   - Given an email with "send now", urgency language, and an address.
   - Expect detection metadata to preserve the address and optionally flag the
     urgency context, but never initiate or suggest an automatic transfer.

## Manual Review Checklist

- Confirm every fixture includes the original message and expected detections.
- Confirm excerpts are short enough for review and do not expose unrelated email
  content.
- Confirm confidence labels are explained in the implementation or docs.
- Confirm no external services are required for baseline detection tests.
- Confirm no personal payment details are embedded in fixtures.

## Regression Expectations

- Adding a new supported address family requires at least one valid fixture and
  one near-miss fixture.
- Any future checksum validation must keep the existing conservative fallback.
- Any UI integration must keep the user in control before copying or opening an
  address in another app.
