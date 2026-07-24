# SLA Deadline Tracker — Specs

Response deadline monitoring for a team's tracked items (emails, tickets,
conversations). This is a self-contained, V1, team-audience tooling workspace.

## Scope

- Release tier: V1
- Audience: team
- Folder ownership: `tools/v1/team/sla-deadline-tracker/`

Do not wire this tool into the main app, routing, inbox architecture, wallet
core, Stellar core, or design system unless a future integration issue
explicitly allows it.

## Purpose

Monitor response-SLA status across a collection of tracked items and surface
which are on-track, due-soon, or breached, plus an aggregate view.

## Architecture

See `ARCHITECTURE.md` for the folder plan and `MODULE_BOUNDARIES.md` for
per-module contracts and import rules. The functional core lives in
`services/slaTracker.ts` (implemented in #450); this issue (#449) establishes
the folder contract only.

## Required issue categories (this tool)

- Architecture ✅ (this issue)
- Feature (core engine — #450)
- UI and accessibility (planned)
- Security and performance (planned)
- Testing and documentation (ongoing)

## Contributor change rules

**May change (inside this folder only):**

- Add or adjust pure logic in `services/` as long as it stays framework-free and
  time is injected (`now`), not `Date.now()`.
- Add fixtures, tests, and docs under `fixtures/`, `tests/`, `docs/`.
- Extend `types/` with new interfaces, keeping existing fields backward
  compatible for `index.ts` consumers.
- Implement the planned `hooks/` and `components/` modules following
  `MODULE_BOUNDARIES.md`.

**May NOT change:**

- Any file outside `tools/v1/team/sla-deadline-tracker/`.
- The main application shell, dashboard layout, navigation, authentication,
  wallet core, mail rendering engine, existing inbox architecture, routing,
  Stellar integration core, database schema, or design system.
- The engine's public signatures in `index.ts` without a coordinated update to
  the integration boundary.
- Introduce network calls, secrets, or production data into the folder.
