# Priority Detector Review Notes

## Scope

This documentation pass is limited to:

```text
tools/v1/individual/priority-detector/
```

It does not wire the tool into the main app, inbox architecture, Gmail, routing,
database schema, wallet services, or shared design system.

## What Changed

- Replaced generated placeholder README content with V1 individual ownership,
  intended usage, priority labels, and testing focus.
- Replaced generated placeholder specs with a reviewable priority model
  contract.
- Added `docs/test-plan.md` with automated, manual, and regression coverage.
- Added `docs/fixtures.md` with synthetic urgent, high, normal, low,
  conflicting, security, and empty-content cases.

## Acceptance Coverage

- Architecture: folder boundary and non-integration constraints are explicit.
- Feature: labels, confidence, signals, explanations, warnings, and conflict
  behavior are defined.
- UI and accessibility: text-visible labels, explanations, warnings, and user
  override expectations are documented.
- Security and performance: no inbox mutation, no external service required,
  bounded parsing, and synthetic fixtures.
- Testing and documentation: test plan and fixture catalog are included.

## Known Limitations

- Sender relationship weighting is only a caller-provided hint in this pass.
- The detector is advisory and cannot prove real-world urgency.
- Future inbox integration must preserve explicit user control before mutation.
