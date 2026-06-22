# Customer Support Macro Tool — Specs

## Purpose

Reusable response templates for customer support agents.  
Agents define macros once and apply them across many conversations,
with variable interpolation (`{{customer_name}}`, etc.) for personalisation.

## Scope

- **Release tier:** V1
- **Audience:** Team
- **Folder ownership:** `tools/v1/team/customer-support-macro-tool/`

This is a self-contained tooling workspace. Do not wire this tool into the main
app, routing, inbox architecture, wallet core, Stellar core, database,
authentication, analytics, or design system unless a future integration issue
explicitly allows it.

## Recommended internal structure

```
customer-support-macro-tool/
├── components/   # React UI (future issue)
├── services/     # Pure business logic (implemented)
├── hooks/        # React hooks (implemented)
├── tests/        # Unit tests + test plan (implemented)
├── fixtures/     # Local test data (implemented)
└── docs/         # Setup, review, and architecture guides (implemented)
```

## Architecture contract

See `docs/ARCHITECTURE.md` for the authoritative folder-local architecture
contract. Future contributors should treat that file as the boundary document
for:

- service, storage, hook, fixture, test, docs, and future component modules;
- data owned by the tool versus data owned by the main app;
- dependency rules and forbidden imports;
- allowed future changes and integration-only changes.

## Required issue categories

| Category                  | Status                                                                        |
| ------------------------- | ----------------------------------------------------------------------------- |
| Architecture              | Addressed — service/storage/hook boundaries and `docs/ARCHITECTURE.md`        |
| Feature                   | Addressed — CRUD, search, sort, interpolation, validation, usage tracking     |
| UI and accessibility      | Deferred — separate UI issue                                                  |
| Security and performance  | Addressed — input validation, no external deps, adapter isolation             |
| Testing and documentation | Addressed — tests, setup, review notes, test plan, and architecture contract  |

## Macro categories

The tool supports the following six macro categories:

- `greeting` — welcome and introduction messages
- `billing` — invoices, payment confirmations
- `technical` — password resets, bug escalations
- `shipping` — order status, dispatch, tracking
- `refund` — refund approvals and status
- `general` — catch-all and closing messages

## Variable interpolation syntax

Variables use double-curly-brace syntax:

```
Hi {{customer_name}}, your ticket {{ticket_id}} has been resolved.
```

Variables are extracted via `extractVariables(body)` and interpolated via
`interpolateMacro(body, variableMap)`.

## Contributor boundary

All work for this tool stays in:

```
tools/v1/team/customer-support-macro-tool/
```

Pull requests that modify files outside this folder will be rejected unless a
future integration issue explicitly grants expanded scope.

Future contributors may:

- add local services, storage adapters, hooks, components, fixtures, tests, and
  docs;
- extend categories, validation, and search behavior with local tests;
- build UI surfaces that remain unmounted and folder-local.

Future contributors may not:

- mount the tool into app routes, dashboards, inbox panels, or compose surfaces;
- send email, mutate mailbox state, write to production tickets, or call live
  support APIs;
- import from main app shell, routing, inbox, wallet, Stellar, database,
  authentication, analytics, or shared design-system internals;
- add live network calls, secrets, provider keys, production customer data, or
  private ticket content.
