# Email Tone Rewriter

This folder is the isolated workspace for the Email Tone Rewriter tool.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v1/individual/email-tone-rewriter/
```

Do not wire this tool into the main app, routing, inbox architecture, compose
flow, wallet core, Stellar core, database schema, notification system, provider
SDKs, AI providers, or existing design system unless a future integration issue
explicitly allows it.

## Contributor Setup

The folder includes a reviewable, folder-local V1 surface:

- `index.ts` exposes the folder-local public API.
- `services/emailToneRewriter.ts` exposes the pure rewrite engine, validation
  helpers, key-point extraction, and UI-ready state mapping.
- `services/guards.ts` sanitizes input and rejects oversized or invalid work
  before the engine runs.
- `services/fixtures.ts` contains synthetic examples for tests and local
  review.
- `components/` contains the idle, loading, error, and success review UI
  surfaces.
- `specs.md` defines behavior, ownership boundaries, module boundaries, and
  contributor rules.
- `docs/ARCHITECTURE.md` documents module boundaries, dependency rules, and
  future integration constraints.
- `docs/DATA_OWNERSHIP.md` documents transient draft ownership, result
  ownership, fixture rules, and privacy limits.
- `docs/test-plan.md`, `docs/threat-model.md`, `docs/performance.md`,
  `docs/fixtures.md`, and `docs/visual-style.md` record local review guidance.
- `tests/architecture-contract.test.mjs` verifies required docs and import
  isolation with Node built-ins.

## Intended Usage

The tool helps an individual user rewrite a draft email into a selected tone,
such as concise, friendly, formal, or apologetic. It accepts a draft, requested
tone, and optional length constraint, then returns a reviewable rewrite without
sending or saving anything automatically.

## Known Limitations

- App integration, route wiring, compose insertion, send actions, persistence,
  and mailbox mutation are intentionally out of scope until a future integration
  issue allows them.
- The rewrite is deterministic and local. It does not call external AI
  providers, production APIs, provider SDKs, or mailbox data.
- The current UI surface is folder-local and should not be treated as mounted in
  the main application.
