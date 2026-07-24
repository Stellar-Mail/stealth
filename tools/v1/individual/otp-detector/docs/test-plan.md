# OTP Detector Test Plan

## Goals

- Verify OTP detection is conservative, explainable, and deterministic.
- Guard against storing, forwarding, auto-filling, or submitting codes.
- Confirm likely false positives are rejected or downgraded.
- Keep all work inside the V1 individual tool folder.

## Automated Cases

1. Six-digit login code

   - Given a login email with "Your verification code is 123456".
   - Expect `otp`, high confidence, masked display, and auth-context signal.

2. Alphanumeric passcode

   - Given an MFA email with a short uppercase alphanumeric code.
   - Expect `otp` or `possible_otp` with the code-shape signal.

3. Expiration window

   - Given a code and "expires in 10 minutes".
   - Expect an expiration signal and optional `expiresAt` when timestamp input
     is supplied.

4. False-positive invoice number

   - Given an invoice email with numeric invoice and amount values.
   - Expect `not_otp` or `unknown` with invoice/amount false-positive signals.

5. Tracking number

   - Given a delivery email with a long tracking number.
   - Expect no high-confidence OTP candidate.

6. Multiple code-like values

   - Given an email with an order number and one verification code.
   - Expect the verification code ranked above the order number.

7. Empty content

   - Given missing subject and body.
   - Expect `unknown` with an insufficient-content warning.

8. Determinism
   - Given the same message twice.
   - Expect identical status, confidence, candidate order, and warnings.

## Manual Review Checklist

- Confirm code values are masked by default in summary surfaces.
- Confirm reveal/copy actions require explicit user interaction.
- Confirm confidence and warnings are visible as text.
- Confirm no code is stored, sent, auto-filled, or submitted.
- Confirm fixtures do not include real OTPs, accounts, or sender identities.

## Regression Expectations

- Adding a new code-shape rule requires one positive fixture and one
  false-positive fixture.
- Adding locale-specific auth terms requires tests for matching and
  non-matching contexts.
- Any future inbox integration must preserve explicit user control before
  copying, revealing, or submitting a code.
