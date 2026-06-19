# OTP Detector Review Notes

## Scope

This documentation pass is limited to:

```text
tools/v1/individual/otp-detector/
```

It does not wire the tool into the main app, inbox architecture, Gmail, routing,
database schema, wallet services, or shared design system.

## What Changed

- Replaced generated placeholder README content with V1 individual ownership,
  intended usage, detection labels, and testing focus.
- Replaced generated placeholder specs with a reviewable OTP detection
  contract.
- Added `docs/test-plan.md` with automated, manual, and regression coverage.
- Added `docs/fixtures.md` with synthetic OTP, MFA, expiration,
  false-positive, tracking, mixed-value, and empty-content cases.

## Acceptance Coverage

- Architecture: folder boundary and non-integration constraints are explicit.
- Feature: status, confidence, candidates, signals, warnings, expiration, and
  masked display behavior are defined.
- UI and accessibility: masking, reveal/copy action, confidence, warnings, and
  context excerpts are documented.
- Security and performance: no storage, external transmission, auto-fill,
  submission, or unbounded parsing is allowed.
- Testing and documentation: test plan and fixture catalog are included.

## Known Limitations

- Baseline detection is pattern/context based and does not verify external
  account state.
- Locale-specific terms are examples until a future implementation adds a full
  dictionary.
- Future inbox integration must preserve explicit user control before copying,
  revealing, or submitting a code.
