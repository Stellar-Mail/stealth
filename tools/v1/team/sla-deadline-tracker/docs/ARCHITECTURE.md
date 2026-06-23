# SLA Deadline Tracker Architecture

## Module Boundaries

```text
tools/v1/team/sla-deadline-tracker/
  components/   UI-only views for queues, filters, deadline cards, and local states
  services/     Pure SLA policy parsing, deadline calculation, sorting, and validation
  hooks/        React adapters over local services and fixture-backed state
  fixtures/     Synthetic deadline records and policies for local tests and demos
  tests/        Folder-local unit, fixture, and architecture contract tests
  docs/         Architecture, contributor boundaries, safety, and integration notes
```

No module in this tool may import from `src/`, sibling tools, `tools/v2/`, or application shell
modules. Shared dependencies must come from the existing package graph or from a future local
tool package file reviewed in a separate dependency-focused change.

## Data Flow

1. A future integration adapter may pass sanitized message metadata into the tool.
2. `services/` validates each deadline record and normalizes timestamps.
3. `services/` computes deadline state using deterministic clock input from the caller.
4. `hooks/` may hold local UI state such as selected status filters or optimistic action feedback.
5. `components/` render read-only derived SLA state and emit local action callbacks.

The core service layer must remain pure: no live network calls, timers, local storage, IndexedDB,
wallet access, or direct mail engine calls.

## Public Folder API

Future contributors may expose a small folder-local API from an `index.ts` or `index.mjs` file.
That export should contain typed service helpers, React components, and fixtures that are safe for
review. It must not mount the tool, register routes, or mutate global app state.

## Failure Model

- Malformed timestamps are rejected by services before rendering.
- Unknown SLA policies fall back to an explicit validation error instead of an inferred deadline.
- Empty message lists render an empty state rather than querying the main inbox.
- Oversized histories are paged, filtered, or summarized before rendering.

## Review Checklist

- Files changed are limited to `tools/v1/team/sla-deadline-tracker/`.
- Docs explain what future contributors may and may not change.
- Any future services are deterministic and testable without network access.
- Any future UI is accessible by keyboard and does not rely on color alone for deadline state.
