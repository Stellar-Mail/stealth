# Email Translator Specs

## Purpose

Translate email body content between languages while preserving enough context
for a user to review the result before sending.

## Contributor Boundary

All work for this tool must stay inside:

```text
tools/v2/individual/email-translator/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet
core, Stellar core, database schema, or shared design system unless a future
integration issue explicitly allows it.

## Required Local Behavior

- Provide empty, loading, error, and success UI states.
- Expose folder-local components for the primary translation workflow.
- Include labelled source and target language controls.
- Include keyboard-accessible actions for translate, review, and copy.
- Document focus, screen-reader, and visual treatment.
- Use synthetic fixtures only.

## Recommended Internal Structure

- `components/` for folder-local UI components.
- `fixtures/` for deterministic translation examples.
- `tests/` for standalone contract checks.
- `docs/` for accessibility and local visual style notes.
