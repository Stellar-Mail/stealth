# Email Ownership Tracker Test Plan

Run from the repository root:

```bash
npx vitest run --config tools/v1/team/email-ownership-tracker/vitest.config.ts
```

## Coverage

- Identifier validation rejects empty, short, path-like, and markup-like input.
- Free-text sanitization removes control characters, collapses whitespace, and
  bounds stored text lengths.
- Ownership event creation normalizes identifiers and refuses malformed input.
- Append operations return new arrays and do not mutate caller-owned history.
- History reads are newest-first and bounded by explicit and maximum limits.
- Released threads report no current owner.
- Summary output is deterministic for review and future UI use.

## Non-Goals

- No React or DOM testing.
- No integration with the main app, inbox, routing, auth, wallet, Stellar, or
  database layers.
- No network or external service calls.
