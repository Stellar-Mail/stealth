# Legal and Compliance Review Flag

Compliance workflow.

## Scope

- Release tier: V2
- Audience: team
- Folder ownership: `tools/v2/team/legal-and-compliance-review-flag/`

This is a self-contained tooling workspace. Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, or design system unless a future integration issue explicitly allows it.

Recommended internal structure:

- components/
- services/
- hooks/
- tests/
- docs/

## Core Feature Contract

The core engine classifies local review contexts for legal/compliance sensitivity.
It must stay deterministic and folder-local until a future integration issue
connects it to real mail, policy, or ticket systems.

The core feature work should:

- validate malformed or missing input,
- document loading, empty, success, and error states for future UI work,
- avoid live network calls, production data, secrets, or global app wiring,
- expose only a folder-local API from `index.mjs`.

## Required issue categories

- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation
