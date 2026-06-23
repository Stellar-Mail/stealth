# Email Ownership Tracker Test Plan

## Scope

This test plan covers the isolated Email Ownership Tracker tool under:

```text
tools/v1/team/email-ownership-tracker/
```

The tool is reviewed independently. Tests must not require the main app shell, routing, wallet,
Stellar core, database, production inbox data, or shared design system integration.

## Core Behavior Coverage

When services are present, folder-local tests should cover:

- ownership event validation for required IDs, actors, owners, actions, and timestamps
- chronological timeline construction from unordered events
- current owner derivation after claim, release, reassignment, and escalation events
- duplicate or conflicting ownership attempts
- malformed addresses, unsupported actions, invalid timestamps, and oversized notes
- empty histories and large-history batch limits

## UI And Accessibility Coverage

When components are present, folder-local tests or manual review notes should cover:

- empty, loading, error, and success states
- keyboard access for claim, release, reassign, open message, and escalation controls
- accessible labels for repeated action buttons
- visible focus states on message rows and action groups
- ownership state represented by text, not color alone

## Documentation Contract Coverage

The documentation contract test verifies that:

- setup, usage, fixtures, known limitations, and review checklist docs exist
- fixture data is synthetic and uses `.test` addresses
- docs state that app-wide integration is out of scope
- docs include contributor commands for local validation
- docs avoid generated template residue and sensitive-field examples

## Contributor Validation Commands

```bash
node tools/v1/team/email-ownership-tracker/tests/documentation-contract.test.mjs
git diff --check
git diff --name-only
```

If service or UI tests are added later, include their exact commands in this document.
