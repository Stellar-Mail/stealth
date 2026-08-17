# Schedule Send Review Notes

## Scope

This documentation pass is limited to:

```text
tools/v1/individual/schedule-send/
```

It does not wire the tool into the main app, Gmail, SMTP, queue workers,
routing, database schema, wallet services, or shared design system.

## What Changed

- Replaced generated placeholder README content with V1 individual ownership,
  intended usage, non-goals, and testing focus.
- Replaced generated placeholder specs with a reviewable schedule-send contract.
- Added `docs/test-plan.md` with automated, manual, and regression coverage.
- Added `docs/fixtures.md` with synthetic future, past, missing-recipient,
  multi-recipient, cancellation, and DST ambiguity cases.

## Acceptance Coverage

- Architecture: folder boundary and non-integration constraints are explicit.
- Feature: schedule model, status language, warnings, and confirmation behavior
  are defined.
- UI and accessibility: timezone visibility, recipient review, and keyboard
  access are documented.
- Security and performance: no automatic send, no credentials, deterministic
  date parsing, and explicit confirmation expectations.
- Testing and documentation: test plan and fixture catalog are included.

## Known Limitations

- Actual queue creation is intentionally reserved for a future integration issue.
- Recurrence is documented as a future regression area, not implemented here.
- Fixtures use `.test` recipients and must not be replaced with real contacts.
