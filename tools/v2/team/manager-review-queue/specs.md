# Manager Review Queue Specs

## Purpose

Provide a folder-local manager approval queue workspace with reviewable tests,
fixtures, and documentation for team approval workflows.

## Contributor Boundary

All work for this tool must stay inside:

```text
tools/v2/team/manager-review-queue/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet
core, Stellar core, database schema, or shared design system unless a future
integration issue explicitly allows it.

## Required Local Behavior

- Keep guard tests, fixtures, and documentation inside the tool folder.
- Validate review id, status, priority, submitter email, notes, subjects, queue
  size, history size, attachment count, and tags.
- Document automated setup, manual review steps, fixtures, and known limits.
- Avoid live network calls, production data, or app-wide test dependencies.

## Recommended Internal Structure

- `guards/` for pure validation and performance guards.
- `fixtures/` for deterministic review request examples.
- `tests/` for standalone Node tests.
- `docs/` for API, accessibility, test plan, review notes, and security notes.
