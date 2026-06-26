# OTP Detector

Detect one-time passcode candidates in a V1 individual workspace.

## Scope

- Release tier: V1
- Audience: individual
- Folder ownership: `tools/v1/individual/otp-detector/`

This is a self-contained tooling workspace. Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, or design system unless a future integration issue explicitly allows it.

## Purpose

Help an individual user find verification codes in email while minimizing
false positives and preventing unsafe code handling.

## Functional Contract

- Input: normalized email subject, body, sender display/address, received time,
  and optional locale.
- Output: one OTP review model.
- The review model should include:
  - `status`
  - `confidence`
  - `candidates`
  - `signals`
  - `warnings`
  - optional `expiresAt`
- Each candidate should include the code value, masked display value, context
  excerpt, and source field.
- The detector must be deterministic for the same input.
- If code-like values conflict with non-auth context, return `possible_otp` or
  `not_otp` with a warning.
- The detector must not persist, forward, auto-fill, submit, or copy codes
  without explicit user action.

## Signal Categories

- Authentication terms such as verify, login, sign in, passcode, MFA, 2FA, OTP,
  security code, or verification code.
- Expiration windows such as "expires in 10 minutes".
- Code shape such as 4-8 digits or short uppercase alphanumeric groups.
- Sender or subject context supplied by the caller.
- False-positive terms such as invoice, receipt, order, tracking, ticket,
  phone, amount, date, or postal code.

## Required Issue Categories

- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation

## UI And Accessibility Expectations

- The code value should be masked by default in shared or list views.
- Confidence and warning text must be visible as text, not color alone.
- Users must be able to reveal or copy a code only through explicit action.
- Context excerpts should be short and screen-reader reachable.

## Security And Performance Expectations

- Do not store OTP values outside the current review result.
- Do not send OTP values to external services in baseline tests.
- Do not auto-fill or submit a detected code.
- Parsing must be bounded for long messages and multiple code-like values.
- Fixtures must use synthetic senders and fake codes only.

## Testing Expectations

See:

- `docs/test-plan.md`
- `docs/fixtures.md`
