# Important Email Pinning Review Notes

## Scope

This documentation pass is limited to:

```text
tools/v1/individual/important-email-pinning/
```

It does not wire the tool into the main app, inbox architecture, Gmail, routing,
database schema, wallet services, or shared design system.

## What Changed

- Replaced generated placeholder README content with V1 individual ownership,
  intended usage, pin states, and testing focus.
- Replaced generated placeholder specs with a reviewable pinning contract.
- Added `docs/test-plan.md` with automated, manual, and regression coverage.
- Added `docs/fixtures.md` with synthetic manual pin, duplicate pin, expired
  pin, advisory urgent message, and empty-input cases.

## Acceptance Coverage

- Architecture: folder boundary and non-integration constraints are explicit.
- Feature: message id, state, reason, timestamps, expiry, duplicate prevention,
  and deterministic sorting behavior are defined.
- UI and accessibility: keyboard controls, visible state, stable layout, reason
  editing, and expired-state text are documented.
- Security and performance: no mailbox mutation, no external metadata
  transmission, summary-only storage, and bounded list handling are documented.
- Testing and documentation: test plan and fixture catalog are included.

## Known Limitations

- Baseline pinning is local and advisory until a future integration issue
  defines persistence.
- Importance hints do not pin automatically.
- Future inbox integration must preserve explicit user action before mailbox
  mutation.
