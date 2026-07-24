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
app, routing, inbox architecture, wallet core, Stellar core, or design system
unless a future integration issue explicitly allows it.

## Recommended internal structure

```
customer-support-macro-tool/
├── components/   # React UI (future issue)
├── services/     # Pure business logic (implemented)
├── hooks/        # React hooks (implemented)
├── tests/        # Unit tests + test plan (implemented)
├── fixtures/     # Local test data (implemented)
└── docs/         # Setup and review guides (implemented)
```

## Required issue categories

| Category                  | Status                                                                    |
| ------------------------- | ------------------------------------------------------------------------- |
| Architecture              | Addressed — service layer, storage adapter pattern, hook interface        |
| Feature                   | Addressed — CRUD, search, sort, interpolation, validation, usage tracking |
| UI and accessibility      | Deferred — separate UI issue                                              |
| Security and performance  | Addressed — input validation, no external deps, immutable patterns        |
| Testing and documentation | ✅ Completed — this issue                                                 |

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

Pull requests that modify files outside this folder will be rejected unless
a future integration issue explicitly grants expanded scope.
