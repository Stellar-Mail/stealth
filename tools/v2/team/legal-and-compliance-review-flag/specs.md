# Legal and Compliance Review Flag Specs

## Purpose

Provide a folder-local foundation for a team workflow that marks inbound mail or
thread events requiring legal or compliance review before the team proceeds.

The tool is intended for review routing and contributor-facing validation only at
this stage. It must not provide legal advice or make final compliance decisions.

## Scope

- Release tier: V2
- Audience: team
- Folder ownership: `tools/v2/team/legal-and-compliance-review-flag/`

This is a self-contained tooling workspace. Do not wire this tool into the main
app, routing, inbox architecture, wallet core, Stellar integration, database
schema, or design system unless a future integration issue explicitly allows it.

## Contributor Boundary

All work for this tool should stay in:

```
tools/v2/team/legal-and-compliance-review-flag/
```

## Required Issue Categories

- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation

## Recommended Internal Structure

- `components/` for future isolated UI pieces.
- `services/` for deterministic review routing and validation logic.
- `hooks/` for future React state wrappers.
- `fixtures/` for synthetic review examples.
- `tests/` for folder-local executable checks.
- `docs/` for setup, test plans, and review notes.

## Review Contract

Future implementation work should keep these behaviors testable without the main
application:

- Review items have stable IDs, email/thread references, risk area, severity,
  status, signals, and recommended action.
- Routing rules map legal and compliance risk areas to named review owners.
- Fixtures use reserved example domains and contain no real personal data.
- High-risk records include enough signals for a reviewer to understand why they
  were flagged.
- Terminal review statuses such as `blocked` and `approved-with-notes` are clearly
  distinguishable from queue statuses.

## Out of Scope

- Main app routes, navigation, dashboard layout, or inbox wiring.
- Wallet, Stellar, payment, or database changes.
- Legal advice, policy generation, or jurisdiction-specific decision automation.
- External API calls, LLM classification, or sender reputation lookups.
