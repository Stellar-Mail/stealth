# Task Extractor Specs

## Purpose

Extract tasks from emails.

## Contributor boundary

All work for this tool should stay in:

`tools/v2/individual/task-extractor/`

This is a self-contained tooling workspace. Do not wire this tool into the
main app, routing, inbox architecture, wallet core, Stellar core, or design
system unless a future integration issue explicitly allows it.

## Internal structure

- `index.ts` — non-UI execution entry point (barrel export)
- `types/` — typed input/output contract and error codes
- `services/` — extraction engine, validation guards, fixtures
- `tests/` — vitest suites
- `docs/` — contract documentation

## Execution contract

The backend-facing contract is documented in `docs/contract.md`:

- Typed inputs (`TaskExtractionInput`, `TaskExtractionOptions`) and outputs
  (`TaskExtractionResult`, `SafeTaskExtractionResult`).
- Machine-readable error codes (`invalid-input`, `invalid-options`,
  `input-too-large`, `empty-content`, `unsupported-language`).
- Fixtures covering success and failure cases in `services/fixtures.ts`.

## Required issue categories

- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation
