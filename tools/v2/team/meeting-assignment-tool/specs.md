# Meeting Assignment Tool

Assign meeting responsibilities to team members based on skills, workload, and capacity.

## Scope

- Release tier: V2
- Audience: Team
- Folder ownership: tools/v2/team/meeting-assignment-tool/

This is a self-contained tooling workspace. Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, or design system unless a future integration issue explicitly allows it.

## Architecture Contract

### Module Boundaries

| Module | Path | Responsibility | May Import From |
|--------|------|----------------|-----------------|
| types | types.ts | Domain types, no runtime code | nothing |
| contract | contract.ts | Typed input/output, error codes, engine interface | types |
| service | service.ts | Non-UI execution entry point | contract, types, services |
| services | services/ | Core pure-function assignment engine | types |
| fixtures | fixtures/ | Deterministic test data (JSON) | nothing |
| helpers | helpers/ | Validation and performance utilities | types |
| tests | tests/ | node:test + vitest suites | all modules |
| docs | docs/ | Review notes, security context | nothing |

### Data Ownership
- Fixtures are deterministic and local — no database, no network, no file system reads at runtime
- Assignment engine is synchronous and pure — no side effects
- The IAssignmentEngine interface is the only public contract boundary for consumers

### Integration Constraints
- Must not import from src/, @/server, @/components, or any main-app module
- Async wrapper (createMeetingAssignmentService) is for UI development only — not production
- Future integration must go through a dedicated adapter, not by importing this tool directly

### Required Issue Categories
- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation
