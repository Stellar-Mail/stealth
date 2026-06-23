# Email Ownership Tracker Specs

## Purpose

Track who owns each shared inbox message, surface stale ownership, and expose
safe local controls for claim, transfer, release, and review workflows.

## Contributor Boundary

All work for this tool must stay inside:

```text
tools/v1/team/email-ownership-tracker/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet
core, Stellar core, database schema, or shared design system unless a future
integration issue explicitly allows it.

## Required Local Behavior

- Provide empty, loading, error, and success UI states.
- Expose folder-local components for the primary ownership workflow.
- Include native keyboard support for filters and ownership actions.
- Provide accessible names for icon-backed controls.
- Document focus, screen-reader, and visual treatment.
- Use synthetic fixtures only.

## Recommended Internal Structure

- `components/` for folder-local UI components.
- `fixtures/` for deterministic ownership examples.
- `tests/` for standalone contract checks.
- `docs/` for accessibility and local visual style notes.
