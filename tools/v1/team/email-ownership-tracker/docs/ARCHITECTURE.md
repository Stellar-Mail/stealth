# Email Ownership Tracker Architecture

## Module Boundaries

```text
tools/v1/team/email-ownership-tracker/
  components/   UI-only views for ownership queues, details, history, and local states
  services/     Pure validation, event normalization, timeline building, and summaries
  hooks/        React adapters over folder-local services and fixture-backed state
  fixtures/     Synthetic ownership events and histories for demos and tests
  tests/        Folder-local unit, fixture, and architecture contract tests
  docs/         Architecture, contributor boundaries, safety, and integration notes
```

No module in this tool may import from `src/`, sibling tools, `tools/v2/`, main app routing,
wallet code, Stellar core, database code, or shared design system internals.

## Data Flow

1. A future integration adapter may pass sanitized message metadata into the tool.
2. `services/` validates ownership events and normalizes timestamps and addresses.
3. `services/` builds a chronological timeline and derives current owner summaries.
4. `hooks/` may manage local selected-message, filter, and optimistic feedback state.
5. `components/` render derived state and emit local action callbacks.

The core service layer must remain pure: no live network calls, timers, local storage, IndexedDB,
wallet access, or direct mail engine calls.

## Ownership State Model

- `claimed`: a team member takes ownership of an unowned message.
- `released`: the current owner clears ownership after resolution or handoff cancellation.
- `reassigned`: ownership moves from one team member to another.
- `escalated`: ownership remains visible while the message is flagged for manager or rotation review.

The tool derives current owner state from events; it does not mutate source mail records.

## Public Folder API

Future contributors may expose a small folder-local API from an `index.ts` or `index.mjs` file.
That export should include typed service helpers, UI components, and synthetic fixtures that are
safe for review. It must not mount the tool, register routes, or mutate global app state.

## Review Checklist

- Files changed are limited to `tools/v1/team/email-ownership-tracker/`.
- Specs explain what future contributors may and may not change.
- Any future services are deterministic and testable without network access.
- Any future UI is keyboard accessible and does not rely on color alone for ownership state.
