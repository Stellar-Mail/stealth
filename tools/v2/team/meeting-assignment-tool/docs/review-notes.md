# Review Notes — Meeting Assignment Tool

## Validated in This Contribution

### Folder-Local Scope

- All source files are inside `tools/v2/team/meeting-assignment-tool/`.
- No imports from `@/components/ui/*`, `@/features/*`, or any main-app module.
- No live network calls, secrets, or production data introduced.

### TypeScript & Build

- `types.ts` compiles with strict TypeScript (project uses `strict: true`).
- `services/meetingAssignmentService.ts` imports only folder-local fixtures and
  its own types.
- Barrel export via `index.ts` exposes the public API without leaking internals.

### Core Logic

`assignMeetings()` is a pure function that:

1. Sorts meetings by priority (desc) then effort (asc).
2. Matches members whose skill set is a superset of `requiredSkills`.
3. Filters by remaining capacity (`weeklyCapacity − currentLoad ≥ effort`).
4. Picks the least-loaded eligible member; ties broken by higher capacity.
5. Mutates a local load counter so each subsequent meeting sees updated loads.

Unassigned reasons are machine-readable:

- `"skill_mismatch"` — no member has the required skills.
- `"capacity"` — skill match found but all eligible members were at capacity.

### State Coverage

| State             | Where handled                                                                     |
| ----------------- | --------------------------------------------------------------------------------- |
| Loading           | `createMeetingAssignmentService()` async wrapper with configurable delay          |
| Error (simulated) | `failureRate` option throws `Error("... simulated")`                              |
| Error (bad input) | `assignMeetings()` throws `TypeError` for non-array arguments                     |
| Empty             | `meetings: []` → `{ assignments: [], summary: { total: 0, coveragePercent: 0 } }` |
| Success           | Full `AssignmentResult` with `assignments[]` and `summary`                        |

### Fixtures

- 4 team members with varied roles, skills, loads, and capacities.
- 7 meetings spanning all assignment outcomes (matched, capacity-blocked, skill-mismatch).

### Test Coverage

17 assertions via `node:test` (no external test runner):

- Per-meeting assignment verification (all 7 meetings).
- Output order preservation.
- Summary statistics (covered %, member effort delta).
- Error/edge-case handling (TypeError, empty input, unknown skill).
- Fixture schema validation.

## Out of Scope (Future Issues)

- Main-app integration (mounting in a route or sidebar).
- Live calendar or inbox data connection.
- Authentication / authorization.
- UI components and hooks.
- Export (CSV, iCal) functionality.
- Conflict detection (overlapping time slots).
- Real-time re-assignment on member availability changes.
