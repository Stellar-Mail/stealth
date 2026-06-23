# Contributor Boundary

## Contributors May Change

- Folder-local docs, tests, fixtures, services, hooks, and components.
- Synthetic SLA policies and deadline records used for deterministic tests.
- Pure helpers for timestamp normalization, deadline calculation, sorting, and status derivation.
- Local accessibility and visual notes for a future UI surface.

## Contributors Must Not Change

- Main application shell, dashboard layout, navigation, routing, or global providers.
- Existing inbox architecture, message rendering, wallet core, Stellar core, or database schema.
- Root package dependencies, repository-wide build settings, or shared design system tokens.
- Production data, secrets, user credentials, payment details, or private mailbox contents.

## Dependency Rules

- Prefer TypeScript or JavaScript standard library APIs for time arithmetic and validation.
- Keep services pure and dependency-light; add dependencies only through a future local package file.
- Do not introduce live network calls, telemetry, cron jobs, or background workers in this folder.
- Fixtures must use `.test` domains and synthetic IDs.

## Integration Constraints

This tool can be integrated only after a future issue defines:

- the sanitized message metadata contract supplied by the main mail app
- the clock source used for deterministic deadline calculation
- the escalation delivery path and permission checks
- the accessibility review path for mounted UI
- the storage ownership boundary for durable SLA records

Until then, the tool remains a self-contained mini-product with local tests and docs only.
