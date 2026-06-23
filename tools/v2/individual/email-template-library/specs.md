# Email Template Library

Personal template system.

## Scope

- Release tier: V2
- Audience: individual
- Folder ownership: `tools/v2/individual/email-template-library/`

This is a self-contained tooling workspace. Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, or design system unless a future integration issue explicitly allows it.

Recommended internal structure:

- components/
- services/
- hooks/
- tests/
- docs/

## Core Feature Contract

The core feature owns a deterministic personal template engine. It should remain
framework-free and folder-local until a future integration issue connects it to
UI, storage, mail compose, or app settings.

The core feature work should:

- validate malformed or missing template input,
- support in-memory create, update, delete, search, and render flows,
- document loading, empty, success, and error states for future UI work,
- avoid live network calls, production data, secrets, persistence, or global app wiring,
- expose only a folder-local API from `index.mjs`.

## Required issue categories

- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation
