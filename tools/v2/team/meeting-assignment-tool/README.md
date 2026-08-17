# Meeting Assignment Tool

Assign meeting responsibilities to team members based on skills, workload, and capacity.

## Ownership Boundary

All work for this tool must stay inside:

```
tools/v2/team/meeting-assignment-tool/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

## Structure

```
contract/           Execution contract (typed input/output, error codes, engine interface) — contract.ts
fixtures/           Deterministic local data (team members, sample meetings, failure scenarios)
services/           Core pure-function logic + async service factory
service.ts          Non-UI service entry point (contract-aware wrapper)
tests/              node:test suite (no external runner required) + Vitest suite
docs/               Review notes and contributor context
types.ts            All domain types
index.ts            Folder-local public API
```

## Run Tests

```bash
node --test tools/v2/team/meeting-assignment-tool/tests/meeting-assignment.test.mjs
```

17 tests, no external dependencies.

## Public API

### Pure backend-facing entry point (`service.ts`)

```ts
import { assignMeetings } from "./service";

const result = assignMeetings({ teamMembers, meetings });
// result satisfies AssignMeetingsOutput
// throws AssignmentError with machine-readable ErrorCode on invalid input
```

The `service.ts` module is the **non-UI execution contract** — deterministic, synchronous, free of I/O. It wraps the core engine with typed errors (`AssignmentError`) and exposes the `IAssignmentEngine` interface for dependency-injection or testing.

### Async UI wrapper (`index.ts` barrel)

```ts
import { assignMeetings, createMeetingAssignmentService } from "./index";

// Pure function — deterministic, synchronous
const result = assignMeetings({ teamMembers, meetings });
// result.assignments[]  — per-meeting assignment with reason
// result.summary        — totals, coverage %, per-member effort delta

// Async service wrapper — simulates delay/failure for UI dev
const svc = createMeetingAssignmentService({ simulateDelay: false });
const data = await svc.assign();

// Contract-aware variant (wraps errors as AssignmentError)
import { assignMeetingsWithContract } from "./index";
const result2 = assignMeetingsWithContract({ teamMembers, meetings });
```

## Error codes

| Code                       | Meaning                                |
| -------------------------- | -------------------------------------- |
| `ERR_INVALID_TEAM_MEMBERS` | `teamMembers` argument is not an array |
| `ERR_INVALID_MEETINGS`     | `meetings` argument is not an array    |
| `ERR_ASSIGNMENT_FAILED`    | Internal assignment error              |

Machine-readable codes are exported as `ErrorCode` from `contract.ts`.

## Assignment Algorithm

1. Sort meetings by priority (desc), then effort (asc).
2. Find members whose skill set covers all `requiredSkills`.
3. Filter by remaining capacity (`weeklyCapacity − currentLoad ≥ effort`).
4. Pick the least-loaded eligible member; ties broken by higher capacity.
5. Unassigned reason is one of: `"matched"` / `"capacity"` / `"skill_mismatch"`.

## Inputs & Outputs

**Input — `TeamMember`**

| Field                | Type       | Description                         |
| -------------------- | ---------- | ----------------------------------- |
| `id`                 | `string`   | Unique identifier                   |
| `name`               | `string`   | Display name                        |
| `skills`             | `string[]` | Skill tags                          |
| `currentMeetingLoad` | `number`   | Meetings already assigned this week |
| `weeklyCapacity`     | `number`   | Max meetings per week               |

**Input — `Meeting`**

| Field            | Type          | Description                        |
| ---------------- | ------------- | ---------------------------------- |
| `id`             | `string`      | Unique identifier                  |
| `requiredSkills` | `string[]`    | Skills needed (empty = any member) |
| `effort`         | `1 \| 2 \| 3` | Weight consumed from capacity      |
| `priority`       | `number`      | Higher = processed first           |

**Output — `MeetingAssignment`**

| Field        | Type                                          | Description                 |
| ------------ | --------------------------------------------- | --------------------------- |
| `assigneeId` | `string \| null`                              | Assigned member id, or null |
| `status`     | `"assigned" \| "unassigned"`                  |                             |
| `reason`     | `"matched" \| "capacity" \| "skill_mismatch"` | Why assigned or not         |

See `types.ts` for full type definitions and `docs/review-notes.md` for contributor notes.
