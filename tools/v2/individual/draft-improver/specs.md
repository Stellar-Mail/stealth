# Draft Improver Specs

## Purpose

Improve draft quality before sending by producing a self-contained review result
with deterministic rewrite suggestions.

## Contributor Boundary

All work for this tool must stay inside:

```text
tools/v2/individual/draft-improver/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet
core, Stellar core, database schema, or shared design system unless a future
integration issue explicitly allows it.

## Required Local Behavior

- Normalize draft inputs without requiring external services.
- Detect missing body content, missing call to action, overly terse drafts,
  overly long drafts, harsh phrasing, excessive punctuation, missing greeting,
  missing signoff, and sensitive-data risk.
- Return a deterministic improved draft body and suggested subject line.
- Mark drafts as `ready`, `needs-review`, `blocked`, or `error`.
- Preserve the original draft id for traceability.
- Keep review fixtures synthetic and free of personal data.

## Recommended Internal Structure

- `services/` for pure core behavior.
- `fixtures/` for deterministic local examples.
- `tests/` for standalone Node tests.
- `docs/` for input, output, loading, and error-state contracts.
