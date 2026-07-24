# Confidential Mode Suggestion

## Purpose

Suggest privacy protections for an email draft before it is sent.

## Scope

- Release tier: V2
- Audience: Individual
- Folder ownership:
  `tools/v2/individual/confidential-mode-suggestion/`

This is a self-contained tooling workspace.

Do not wire this tool into the main application, routing, inbox architecture, wallet core, Stellar integration, database schema, or shared design system unless a future integration issue explicitly allows it.

## Recommended Internal Structure

- components/
- services/
- hooks/
- tests/
- docs/
- fixtures/
- types/

## Required Issue Categories

- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation
