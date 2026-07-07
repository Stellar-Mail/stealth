# Customer Support Macro Tool Specs

## Purpose

Reusable response templates for customer support agents. Agents define macros
once and apply them across many conversations with variable interpolation such
as `{{customer_name}}` and `{{ticket_id}}`.

## Scope

- Release tier: V1 launch tool
- Audience: team
- Folder ownership: `tools/v1/team/customer-support-macro-tool/`
- Integration status: isolated mini-product workspace

This is a self-contained tool workspace. Do not wire this tool into the main
app, routing, inbox architecture, wallet core, Stellar core, database schema, or
shared design system unless a future integration issue explicitly allows it.

## Module Boundaries

| Module                        | Purpose                                                                              | Change Rules                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `services/macro.service.ts`   | Pure CRUD, validation, search, sorting, variable extraction, and interpolation logic | Keep the service deterministic and side-effect free.                         |
| `services/storage.service.ts` | Folder-local `StorageAdapter`, browser localStorage adapter, and in-memory adapter   | Do not replace this with database or app storage in this issue.              |
| `hooks/useMacros.ts`          | React hook that binds macro services to local state and storage adapter persistence  | Keep integration through explicit adapter options; do not import app stores. |
| `fixtures/`                   | Local macro examples for tests and development                                       | Do not include real customers, real tickets, secrets, or production content. |
| `tests/`                      | Unit tests, test plan, and architecture contract checks                              | Keep tests folder-local and independent from main app setup.                 |
| `docs/`                       | Setup, review notes, architecture, and data ownership guidance                       | Document future integration boundaries instead of implementing them here.    |

Future `components/` files may be added inside this folder by a UI-specific
issue, but this architecture issue does not mount any UI into the app shell.

## Required Issue Categories

| Category                  | Status                                                                                                          |
| ------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Architecture              | Addressed through `docs/ARCHITECTURE.md`, `docs/DATA_OWNERSHIP.md`, and `tests/architecture-contract.test.mjs`. |
| Feature                   | Existing service layer covers CRUD, search, sort, interpolation, validation, and usage tracking.                |
| UI and accessibility      | Deferred to a separate UI issue.                                                                                |
| Security and performance  | Existing validation, local fixtures, adapter boundaries, and no external provider calls.                        |
| Testing and documentation | Existing Vitest suites plus the architecture contract test and docs.                                            |

## Macro Categories

The tool supports these macro categories:

- `greeting`: welcome and introduction messages
- `billing`: invoices and payment confirmations
- `technical`: password resets and bug escalations
- `shipping`: order status, dispatch, and tracking
- `refund`: refund approvals and status
- `general`: catch-all and closing messages

## Variable Interpolation Syntax

Variables use double-curly-brace syntax:

```text
Hi {{customer_name}}, your ticket {{ticket_id}} has been resolved.
```

Variables are extracted via `extractVariables(body)` and interpolated via
`interpolateMacro(body, variableMap)`.

## Contributor Boundary

Future contributors may change:

- Folder-local docs, tests, fixtures, and service internals.
- Macro validation, search, sorting, and interpolation rules when matching tests
  are updated.
- Storage adapter implementations when they remain inside this folder and keep
  the `StorageAdapter` contract.
- Future `components/` files inside this folder when a scoped UI issue asks for
  them.

Future contributors may not change in this issue:

- Main application shell, dashboard layout, navigation, or routing.
- Existing inbox architecture, mail rendering engine, or compose-send flow.
- Authentication, wallet core, Stellar core, payment flows, or database schema.
- Shared design system files or global style tokens.
- Server APIs, provider SDKs, webhooks, notification delivery, or background
  jobs.
- Files outside `tools/v1/team/customer-support-macro-tool/`.

Any future integration issue must define authorization, team-sharing rules,
server persistence, audit history, and compose-window insertion behavior before
this tool touches live mail data.
