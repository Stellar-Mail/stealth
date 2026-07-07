# Meeting Assignment Tool Specs

## Purpose

The Meeting Assignment Tool assigns meeting responsibilities to available team members using folder-local fixtures, deterministic workload balancing, and explicit unassigned reasons.

## Scope

- Release tier: V2 later-release tool
- Audience: team
- Folder ownership: `tools/v2/team/meeting-assignment-tool/`
- Integration status: isolated mini-product, not wired into the main app

This issue defines the architecture and folder contract around the existing local service, helpers, fixtures, docs, and tests. It does not add application routing, shared UI adoption, production data access, persistence, or external provider calls.

## Module Boundaries

| Module      | Purpose                                                                     | Change Rules                                                                      |
| ----------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `index.ts`  | Public barrel export for the folder-local API                               | Keep external imports pointed at this file; do not export fixtures as stable API. |
| `types.ts`  | Domain types for members, meetings, assignments, summaries, and load states | Add fields only with matching docs and tests.                                     |
| `services/` | Assignment engine and async service wrapper                                 | Keep deterministic core logic pure and side-effect free.                          |
| `helpers/`  | Validation and performance guard helpers                                    | Keep guards folder-local and independent from app services.                       |
| `fixtures/` | Deterministic sample team and meeting data                                  | Do not mutate fixtures at runtime or treat them as production data.               |
| `tests/`    | Behavior, fixture, and architecture contract checks                         | Use local fixtures and Node-compatible tests for contributor review.              |
| `docs/`     | Architecture, data ownership, security, and review notes                    | Document future integration instead of implementing it in this issue.             |

## Contributor Boundary

Future contributors may change:

- Folder-local docs, fixtures, tests, and helper utilities.
- Service internals when the public assignment result contract stays compatible.
- Future `components/` or `hooks/` files inside this folder when a UI issue adds them.
- Validation and performance limits when the docs and tests are updated together.

Future contributors may not change in this issue:

- Main application shell, dashboard layout, navigation, or routing.
- Existing inbox architecture or mail rendering engine.
- Authentication, wallet core, Stellar core, payment flows, or database schema.
- Shared design system files or global style tokens.
- Files outside `tools/v2/team/meeting-assignment-tool/`.

## Required Issue Categories

- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation

## Acceptance Checklist

- The tool has a clear folder-local architecture plan.
- The specs explain what future contributors may and may not change.
- The data ownership document separates fixture data, service state, helper validation, and future integration adapters.
- Tests can verify the architecture contract without main app wiring.
- All files changed by this issue stay inside `tools/v2/team/meeting-assignment-tool/`.
