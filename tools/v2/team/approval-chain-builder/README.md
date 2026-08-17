# Approval Chain Builder

This folder is the isolated workspace for the Approval Chain Builder tool.

## Ownership Boundary

All work for this tool must stay inside:

`text
.\tools\v2\team\approval-chain-builder\
`

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

See specs.md for the issue categories and contributor expectations.

## Non-UI execution

The public backend-facing API is exported from `index.ts`. Use
`approvalChainBuilderService.execute(input)` for in-memory construction, or
`createApprovalChainBuilderService({ repository })` to inject persistence.

Typed inputs, outputs, errors, service boundaries, and fixtures are documented
in [CONTRACT.md](./CONTRACT.md).
