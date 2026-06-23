# Knowledge Base Suggestion

Suggest internal documentation.

## Scope

- Release tier: V2
- Audience: team
- Folder ownership: `tools/v2/team/knowledge-base-suggestion/`

This is a self-contained tooling workspace. Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, or design system unless a future integration issue explicitly allows it.

Recommended internal structure:

- components/
- services/
- hooks/
- tests/
- docs/

## Core Feature Contract

The core engine accepts a local mail/support context and a local article list,
then returns ranked knowledge base suggestions. It must remain deterministic
until a future integration issue connects it to a real knowledge base.

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
