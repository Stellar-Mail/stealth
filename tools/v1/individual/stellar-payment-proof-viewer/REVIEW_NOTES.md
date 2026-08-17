# Stellar Payment Proof Viewer Review Notes

## Scope

This documentation pass is limited to:

```text
tools/v1/individual/stellar-payment-proof-viewer/
```

It does not wire the tool into the main app, wallet core, Stellar services,
routing, database schema, inbox processing, or shared design system.

## What Changed

- Replaced generated placeholder README content with V1 individual ownership,
  intended usage, non-goals, and testing focus.
- Replaced generated placeholder specs with a reviewable proof-viewer contract.
- Added `docs/test-plan.md` with automated, manual, and regression coverage.
- Added `docs/fixtures.md` with synthetic complete, partial, conflicting,
  unsupported, and suspicious proof examples.

## Acceptance Coverage

- Architecture: folder boundary and non-integration constraints are explicit.
- Feature: proof fields, status language, and conflict behavior are defined.
- UI and accessibility: long-value copyability and text-visible status labels
  are documented.
- Security and performance: no automatic payment behavior; no trust claim from
  pasted data; bounded parsing expectations.
- Testing and documentation: test plan and fixture catalog are included.

## Known Limitations

- Network verification is intentionally reserved for a future integration issue.
- Synthetic Stellar IDs are parser/display fixtures, not real payment proof.
- OCR and screenshot extraction are out of scope for this documentation-only
  pass unless a future issue requests them.
