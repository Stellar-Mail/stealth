# Stellar Payment Proof Viewer Test Plan

## Goals

- Verify that supplied Stellar payment proof data renders clearly and safely.
- Distinguish provided, format-valid, conflict, unsupported, and future
  network-verified states.
- Ensure missing fields are not invented.
- Keep all work inside the V1 individual tool folder.

## Automated Cases

1. Complete provided proof

   - Given a transaction hash, source account, destination account, asset,
     amount, memo, ledger, and timestamp.
   - Expect every field to render with `provided` status and stable labels.

2. Format-valid Stellar fields

   - Given synthetic account IDs and a 64-character transaction hash.
   - Expect plausible-format indicators for account and hash fields.

3. Missing optional fields

   - Given a proof without memo and issuer.
   - Expect those fields to show `unknown` or remain absent according to the
     component contract, without fabricated fallback values.

4. Conflicting amount

   - Given email body amount `25 XLM` and attachment amount `20 XLM`.
   - Expect a `conflict` state that names both supplied values.

5. Unsupported asset

   - Given an asset code or issuer format outside supported Stellar patterns.
   - Expect an `unsupported` warning and no verification claim.

6. Suspicious memo text

   - Given a memo containing urgency or instructions unrelated to proof review.
   - Expect memo text to be displayed as provided and optionally flagged, but no
     automated payment action.

7. Long-value accessibility

   - Given long account IDs and hashes.
   - Expect full values to be copyable and status labels to be text-visible.

8. Large pasted message
   - Given a long email thread with one proof-like section.
   - Expect parsing to stay bounded and deterministic.

## Manual Review Checklist

- Confirm the screen never says "verified" unless the status is explicitly
  network-verified.
- Confirm copy buttons do not auto-copy on page load or hover.
- Confirm keyboard focus can reach long-value controls.
- Confirm fixtures use synthetic account IDs and hashes.
- Confirm all documentation and tests remain folder-local.

## Regression Expectations

- Adding a new proof source requires one complete fixture and one conflict
  fixture.
- Adding network lookup requires tests for unavailable, mismatched, and matching
  network responses.
- Any UI integration must preserve manual review before trust or action.
