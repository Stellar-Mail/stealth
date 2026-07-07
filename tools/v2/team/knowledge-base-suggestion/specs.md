# Knowledge Base Suggestion

Suggest internal documentation from repeated team email patterns while keeping
the tool isolated from the main mail app until a future integration issue.

## Scope

- Release tier: V2
- Audience: team
- Folder ownership: `tools/v2/team/knowledge-base-suggestion/`

This is a self-contained tooling workspace. Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, or design system unless a future integration issue explicitly allows it.

## Recommended Internal Structure

- components/
- services/
- hooks/
- docs/
- tests/

## Module Boundary Summary

- `components/`: presentational and container UI for reviewing suggestion
  candidates, evidence summaries, confidence, and reviewer actions.
- `services/`: pure business logic for detecting suggestion candidates,
  scoring repeated themes, normalizing evidence, and preparing review payloads.
- `hooks/`: local React state adapters that bridge components to services
  without reaching into app-wide stores.
- `tests/`: folder-local contract, fixture, service, hook, and component tests.
- `docs/`: architecture notes, data ownership rules, review plans, and future
  integration notes.

## Data Ownership

This tool may own local suggestion drafts, review states, scoring metadata,
source evidence references, and synthetic fixtures inside this folder. It must
not own or mutate live inbox threads, rendered mail, user profiles, wallet
state, Stellar data, database rows, or production knowledge base records.

## Dependency Rules

- Components may depend on hooks and local types.
- Hooks may depend on services and local types.
- Services may depend on local fixtures, local types, and standard JavaScript
  utilities.
- Tests may import local modules and read local docs or fixtures.
- Docs must remain descriptive and must not require runtime integration.

Components should not call services directly once hooks exist. Services should
not import React, app shell modules, route modules, auth, wallet, Stellar, inbox,
mail rendering, or database code.

## Contributor Boundary

All work for this tool should stay in:

```text
tools/v2/team/knowledge-base-suggestion/
```

## Required issue categories

- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation

## Future Integration Constraints

Future app integration must be a separate issue. That follow-up should pass
mail evidence into this tool through an adapter instead of letting this folder
read the inbox directly. It should also keep knowledge base publishing,
database persistence, notifications, approval workflows, routing, and auth
checks outside this architecture-only contribution until explicitly approved.
