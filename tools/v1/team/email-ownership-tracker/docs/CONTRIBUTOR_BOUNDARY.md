# Contributor Boundary

## Contributors May Change

- Folder-local docs, tests, fixtures, services, hooks, and components.
- Synthetic ownership histories for deterministic tests and demos.
- Pure helpers for event validation, timeline construction, filtering, and summary derivation.
- Local accessibility and visual notes for a future UI surface.

## Contributors Must Not Change

- Main application shell, dashboard layout, navigation, routing, or global providers.
- Existing inbox architecture, message rendering, wallet core, Stellar core, or database schema.
- Root package dependencies, repository-wide build settings, or shared design system tokens.
- Production data, user credentials, private mailbox contents, secrets, or payment details.

## Dependency Rules

- Prefer JavaScript or TypeScript standard library APIs for timestamp and string validation.
- Keep services pure and dependency-light.
- Do not introduce live network calls, telemetry, cron jobs, local storage, or background workers.
- Fixtures must use `.test` domains and synthetic IDs.

## Integration Constraints

This tool can be integrated only after a future issue defines:

- the sanitized message metadata contract supplied by the main mail app
- the permission model for claiming, releasing, reassigning, and escalating ownership
- the storage ownership boundary for durable ownership history
- the UI accessibility review path for a mounted route or panel
- the conflict behavior when two team members try to claim the same message

Until then, the tool remains a self-contained mini-product with local tests and docs only.
