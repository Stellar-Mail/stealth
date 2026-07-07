# Review Notes - Meeting Assignment Tool

## Validated in This Contribution

### Folder-Local Scope

- All source files are inside `tools/v2/team/meeting-assignment-tool/`.
- No imports from `@/components/ui/*`, `@/features/*`, `src/`, or any main-app module.
- No live network calls, secrets, production data, persistence, wallet calls, or Stellar calls are introduced.

### Architecture Contract

- `docs/ARCHITECTURE.md` defines module boundaries, dependency rules, and future integration constraints.
- `docs/DATA_OWNERSHIP.md` defines owned data, fixture rules, runtime state, and adapter boundaries.
- `specs.md` explains what future contributors may and may not change.
- `tests/architecture-contract.test.mjs` verifies required docs, isolation claims, and missing template leftovers.

### TypeScript and Build

- `types.ts` declares the domain contract for team members, meetings, assignments, summaries, and load states.
- `services/meetingAssignmentService.ts` imports only folder-local fixtures and its own types.
- `index.ts` exposes the public API without leaking fixtures or helper internals as stable app API.

### Core Logic

`assignMeetings()` is a pure function that:

1. Sorts meetings by priority descending, then effort ascending.
2. Matches members whose skill set is a superset of `requiredSkills`.
3. Filters by remaining capacity (`weeklyCapacity - currentLoad >= effort`).
4. Picks the least-loaded eligible member; ties are broken by higher capacity.
5. Mutates a local load counter so each subsequent meeting sees updated loads.

Unassigned reasons are machine-readable:

- `"skill_mismatch"` means no member has the required skills.
- `"capacity"` means a skill match exists but all eligible members are at capacity.

### State Coverage

| State             | Where handled                                                            |
| ----------------- | ------------------------------------------------------------------------ |
| Loading           | `createMeetingAssignmentService()` async wrapper with configurable delay |
| Error (simulated) | `failureRate` option throws `Error("... simulated")`                     |
| Error (bad input) | `assignMeetings()` throws `TypeError` for non-array arguments            |
| Empty             | `meetings: []` returns empty assignments and zero coverage               |
| Success           | Full `AssignmentResult` with `assignments[]` and `summary`               |

### Fixtures

- 4 team members with varied roles, skills, loads, and capacities.
- 7 meetings spanning matched and capacity-blocked outcomes.

### Test Coverage

Behavior tests via `node:test` cover:

- Per-meeting assignment verification.
- Output order preservation.
- Summary statistics.
- Error and edge-case handling.
- Fixture schema validation.

Architecture tests via `node:test` cover:

- Required architecture docs.
- Folder path and forbidden integration statements.
- Relative import isolation.
- Removal of broken template tokens in docs.

## Out of Scope

- Main-app integration or route mounting.
- Live calendar, inbox, or team directory data.
- Authentication and authorization.
- Shared design-system adoption.
- Database or browser persistence.
- Export workflows such as CSV or iCal.
- Conflict detection for overlapping time slots.
- Real-time re-assignment on member availability changes.
