# OTP Detector

V1 individual tool workspace for detecting one-time passcodes in email content.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v1/individual/otp-detector/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

## Intended Use

- Inspect normalized subject and body text for one-time passcode patterns.
- Return candidate OTP values with confidence, nearby context, and warnings.
- Avoid treating invoices, order IDs, phone numbers, dates, and ticket numbers
  as OTPs.
- Keep the detector advisory; it must not store, forward, auto-fill, or submit
  codes.

## Detection Labels

- `otp`: high-confidence one-time passcode candidate.
- `possible_otp`: code-like value with weaker or conflicting context.
- `not_otp`: numeric or alphanumeric value with non-authentication context.
- `unknown`: insufficient content or conflicting signals.

## Testing Focus

Use `docs/test-plan.md` and `docs/fixtures.md` to cover six-digit codes,
alphanumeric codes, expiration windows, multilingual auth context, false
positives, empty content, redaction behavior, and deterministic ranking.
