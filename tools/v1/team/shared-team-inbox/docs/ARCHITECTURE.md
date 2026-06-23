# Shared Team Inbox Architecture

## Folder Contract

```text
tools/v1/team/shared-team-inbox/
  components/   UI-only views for message queues, filters, ownership, comments, and local states
  services/     Pure message, assignment, status, comment, and reply workflow helpers
  hooks/        React adapters over folder-local services and fixture-backed state
  fixtures/     Synthetic shared inbox messages, assignments, comments, replies, and rosters
  tests/        Folder-local unit, fixture, documentation, and architecture contract tests
  docs/         Architecture, contributor boundaries, safety, and integration notes
```

No module in this tool may import from `src/`, sibling tools, `tools/v2/`, main app routing,
wallet code, Stellar core, database code, existing inbox internals, mail rendering, or shared
design system internals.

## Data Ownership

The tool owns derived collaboration metadata only:

- shared inbox ID or address
- message reference ID and bounded preview metadata
- assignment owner and handoff metadata
- internal comment metadata owned by the team-only surface
- status value: `unassigned`, `claimed`, `in-progress`, `awaiting-reply`, or `resolved`
- reply draft metadata for future shared-identity sending

The tool must not become the source of truth for full message bodies, private mailbox contents,
wallet identities, sender credentials, delivery proof verification, payment details, or permanent
audit logs.

## Dependency Rules

- Prefer JavaScript or TypeScript standard library APIs for local validation and sorting.
- Keep services pure and deterministic unless a future integration issue defines an adapter.
- Do not add root dependencies or repository-wide build settings from this tool.
- No live network calls, telemetry, cron jobs, local storage, or background workers are allowed.
- Fixtures must use `.test` domains and synthetic IDs.

## Data Flow

1. A future integration adapter may pass sanitized shared inbox metadata into the tool.
2. `services/` validate and normalize message, assignment, comment, and reply data.
3. `hooks/` may manage local UI state such as active filters, optimistic status changes, and retry
   messages.
4. `components/` render derived state and emit folder-local action callbacks.
5. External delivery, durable persistence, and app mounting remain outside this tool until separate
   integration issues define them.

## Review Checklist

- Files changed are limited to `tools/v1/team/shared-team-inbox/`.
- Specs explain what future contributors may and may not change.
- New behavior is reviewable without app-wide routes, database, wallet, or mail engine changes.
- Future UI remains accessible by keyboard and does not rely on color alone for state.
- Team-only data is never included in external-facing payloads.
