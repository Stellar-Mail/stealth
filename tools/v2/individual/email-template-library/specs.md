# Email Template Library Specs

## Purpose

Personal template system.

## Scope

- Release tier: V2
- Audience: individual
- Folder ownership: `tools/v2/individual/email-template-library/`

This is a self-contained tooling workspace. Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, mail rendering engine, or shared design system unless a future integration issue explicitly allows it.

Recommended internal structure:

- components/
- services/
- hooks/
- tests/
- docs/

## Required Issue Categories

- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation

## Implemented UI Scope

- Folder-local React component for browsing, filtering, previewing, and selecting templates.
- Deterministic local fixtures for individual email template categories.
- Loading, error, empty, and successful selection states.
- Native keyboard and focus behavior through labeled inputs and buttons.
- Local review documentation for accessibility and visual style decisions.
