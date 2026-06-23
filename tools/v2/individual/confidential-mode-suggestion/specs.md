# Confidential Mode Suggestion Specs

## Purpose

Suggest privacy protections before a user sends a sensitive message.

## Contributor Boundary

All work for this tool must stay inside:

```text
tools/v2/individual/confidential-mode-suggestion/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet
core, Stellar core, database schema, or shared design system unless a future
integration issue explicitly allows it.

## Required Local Behavior

- Provide empty, loading, error, and ready UI states.
- Expose folder-local components for the primary review workflow.
- Include native keyboard support for filters and actions.
- Provide accessible labels for icon-backed controls.
- Document focus, screen-reader, and visual treatment.
- Use synthetic fixtures only.

## Recommended Internal Structure

- `components/` for folder-local UI components.
- `fixtures/` for deterministic suggestion examples.
- `tests/` for standalone contract checks.
- `docs/` for accessibility and local visual style notes.
