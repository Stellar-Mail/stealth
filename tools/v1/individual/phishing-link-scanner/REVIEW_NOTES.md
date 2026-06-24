# Phishing Link Scanner Review Notes

## Scope

This documentation pass is limited to:

```text
tools/v1/individual/phishing-link-scanner/
```

It does not wire the tool into the main app, inbox architecture, Gmail, routing,
database schema, wallet services, or shared design system.

## What Changed

- Replaced generated placeholder README content with V1 individual ownership,
  intended usage, risk labels, and testing focus.
- Replaced generated placeholder specs with a reviewable phishing scan contract.
- Added `docs/test-plan.md` with automated, manual, and regression coverage.
- Added `docs/fixtures.md` with synthetic mismatch, punycode, shortener,
  trusted-domain, newsletter, and empty-input cases.

## Acceptance Coverage

- Architecture: folder boundary and non-integration constraints are explicit.
- Feature: risk, confidence, per-link results, signals, warnings, and
  recommended action are defined.
- UI and accessibility: text-visible labels, accessible warnings, and long URL
  handling are documented.
- Security and performance: no link opening/fetching, no external reputation
  service requirement, bounded parsing, and synthetic fixtures.
- Testing and documentation: test plan and fixture catalog are included.

## Known Limitations

- Baseline tests do not perform live reputation lookups or redirect expansion.
- Trusted-domain handling is only a caller-provided hint in this pass.
- Future inbox integration must preserve explicit user control before mutation.
