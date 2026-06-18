# Team Security Flagging

Team Security Flagging is an isolated V2 team tool engine for reporting,
tracking, and triaging security-related email concerns inside the Stealth
Tooling Ecosystem.

## Ownership Boundary

✅ All work for this tool must stay inside:

```text
tools/v2/team/team-security-flagging/
```

❌ Do not modify from this issue:

- Main application shell, dashboard layout, or global routing
- Existing inbox architecture, mail rendering engine, or message ingestion
- Authentication, wallet core, Stellar integration, or payment systems
- Shared database schema, API contracts, or backend persistence models
- Existing shared design system components or tokens

## Tool Intent

This workspace is a self-contained mini-product. It defines the architecture
contract for a local review engine that can model security flags, status
progression, and team review workflows without being connected to the main app.

See `docs/ARCHITECTURE.md` for the isolated architecture contract.

## What belongs here

- `README.md` and `specs.md` for contract and review expectations
- `docs/ARCHITECTURE.md` for architecture, data, and flow design
- `types/` for local type definitions and contract models
- `services/` for pure business logic and in-memory state handling
- `components/` for isolated UI surface and local component composition
- `hooks/` for tool-local state and behavior abstractions
- `fixtures/` for deterministic example data
- `tests/` for unit and contract tests

## Review guidance

- Keep all development, documentation, and tests inside this folder.
- Do not wire it into the Stealth main app until a future integration issue
  explicitly adds routing, authentication, and persistence.
- Use local mock data and local state only.
- Preserve the existing application architecture and platform contracts.
