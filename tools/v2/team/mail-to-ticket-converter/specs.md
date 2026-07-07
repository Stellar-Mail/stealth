# Mail-to-Ticket Converter

Convert email evidence into reviewable ticket drafts while keeping live inbox
and ticketing integration out of this architecture-only issue.

## Scope

- Release tier: V2
- Audience: team
- Folder ownership: `tools/v2/team/mail-to-ticket-converter/`

This is a self-contained tooling workspace. Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, or design system unless a future integration issue explicitly allows it.

## Recommended Internal Structure

- components/
- services/
- hooks/
- docs/
- tests/

## Module Boundary Summary

- `components/`: UI for reviewing draft tickets, extracted fields, evidence,
  duplicate warnings, and reviewer actions.
- `services/`: pure logic for normalizing email evidence, extracting ticket
  fields, scoring confidence, detecting duplicates, and modeling draft states.
- `hooks/`: local React state adapters that connect components to services
  without reaching into app-wide stores.
- `tests/`: folder-local contract, fixture, service, hook, and component tests.
- `docs/`: architecture notes, data ownership rules, review plans, and future
  integration notes.

## Data Ownership

This tool may own local ticket drafts, extracted fields, evidence summaries,
confidence signals, duplicate hints, review notes, and synthetic fixtures inside
this folder. It must not own or mutate live inbox threads, rendered mail,
attachments, ticketing provider records, user profiles, wallet state, Stellar
data, database rows, or production audit trails.

## Dependency Rules

- Components may depend on hooks and local types.
- Hooks may depend on services and local types.
- Services may depend on local fixtures, local types, and standard JavaScript
  utilities.
- Tests may import local modules and read local docs or fixtures.
- Docs must remain descriptive and must not require runtime integration.

Components should not call services directly once hooks exist. Services should
not import React, app shell modules, route modules, auth, wallet, Stellar, inbox,
mail rendering, database, or ticketing provider code.

## Contributor Boundary

All work for this tool should stay in:

```text
tools/v2/team/mail-to-ticket-converter/
```

## Required issue categories

- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation

## Future Integration Constraints

Future app integration must be a separate issue. That follow-up should pass
sanitized email evidence into this tool through an adapter instead of letting
this folder read the inbox directly. It should also keep ticket creation,
ticket updates, provider authentication, database persistence, notifications,
routing, and auth checks outside this architecture-only contribution until
explicitly approved.
