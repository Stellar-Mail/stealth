# Email Ownership Tracker Specs

## Purpose

Track ownership history for team inbox threads before this tool is integrated
with the main mail product.

## Scope

- **Release tier:** V1
- **Audience:** Team
- **Folder ownership:** `tools/v1/team/email-ownership-tracker/`

This is a self-contained tooling workspace. Do not wire this tool into the main
app, routing, inbox architecture, wallet core, Stellar core, database schema, or
design system unless a future integration issue explicitly allows it.

## Required Issue Categories

| Category | Status |
| --- | --- |
| Architecture | Addressed with pure service functions and folder-local types |
| Feature | Addressed with ownership event creation, append, history, and summary helpers |
| UI and accessibility | Deferred to a separate UI issue |
| Security and performance | Addressed with validation, sanitization, and bounded history reads |
| Testing and documentation | Addressed with fixtures, unit tests, setup notes, and review notes |

## Data Model

Ownership events are append-only records. Each event includes:

- `threadId`
- `ownerId`
- `actorId`
- `action`
- `reason`
- `note`
- `createdAt`

Current ownership is derived from the newest valid event for a thread.

## Security and Performance Requirements

- Reject empty or malformed thread, owner, and actor identifiers.
- Normalize identifiers to lowercase trimmed strings.
- Sanitize free-text fields by removing control characters and collapsing
  whitespace.
- Bound reason and note lengths before storing.
- Bound history reads with explicit limits.
- Avoid mutating caller-provided event arrays.

## Contributor Boundary

All work for this tool stays in:

```text
tools/v1/team/email-ownership-tracker/
```

Pull requests that modify files outside this folder should be rejected unless a
future integration issue explicitly grants expanded scope.
