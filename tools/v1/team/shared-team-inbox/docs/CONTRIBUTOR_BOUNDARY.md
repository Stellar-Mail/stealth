# Shared Team Inbox Contributor Boundary

## Contributors May Change

- Folder-local docs, tests, fixtures, services, hooks, and components.
- Synthetic messages, assignments, comments, replies, and team rosters used for local tests.
- Pure helpers for validation, status transitions, assignment summaries, and fixture-backed state.
- Local accessibility and visual notes for a future UI surface.

## Contributors Must Not Change

- Main application shell, dashboard layout, navigation, routing, or global providers.
- Existing inbox architecture, mail rendering, wallet core, Stellar core, or database schema.
- Root package dependencies, repository-wide build settings, or shared design system tokens.
- Production data, user credentials, private mailbox contents, secrets, or payment details.

## Integration Constraints

This tool can be integrated only after a future issue defines:

- the sanitized shared inbox metadata contract supplied by the main mail app
- the permission model for claims, releases, internal comments, and replies
- the shared identity reply path and audit requirements
- the storage ownership boundary for durable team state
- the accessibility review path for a mounted route or panel
- the conflict behavior when multiple members act on the same message

Until then, the tool remains a self-contained mini-product with local tests and docs only.
