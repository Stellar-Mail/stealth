# Meeting Assignment Tool

Assign meeting responsibilities to team members based on skills, workload, priority, and capacity.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v2/team/meeting-assignment-tool/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

## Structure

```text
fixtures/           Deterministic local data for team members and sample meetings
services/           Core pure-function logic plus async service factory
helpers/            Folder-local validation and performance guards
tests/              Local contract and behavior tests
docs/               Architecture, data ownership, security, and reviewer notes
types.ts            Domain types for inputs, outputs, and load states
index.ts            Folder-local public API
specs.md            Contributor-facing scope and implementation contract
```

The current release does not create app shell routes, shared UI components, auth bindings, persistence adapters, wallet calls, Stellar calls, or inbox integrations.

## Run Tests

```bash
node --test tools/v2/team/meeting-assignment-tool/tests/meeting-assignment.test.mjs
node --test tools/v2/team/meeting-assignment-tool/tests/architecture-contract.test.mjs
```

## Public API

```ts
import { assignMeetings, createMeetingAssignmentService } from "./index";

// Pure function: deterministic and synchronous.
const result = assignMeetings({ teamMembers, meetings });
// result.assignments[]: per-meeting assignment with reason
// result.summary: totals, coverage %, per-member effort delta

// Async service wrapper: simulates delay/failure for UI development.
const svc = createMeetingAssignmentService({ simulateDelay: false });
const data = await svc.assign();
```

## Assignment Algorithm

1. Sort meetings by priority descending, then effort ascending.
2. Find members whose skill set covers all `requiredSkills`.
3. Filter by remaining capacity (`weeklyCapacity - currentLoad >= effort`).
4. Pick the least-loaded eligible member; ties are broken by higher capacity.
5. Report unassigned reason as `"capacity"` or `"skill_mismatch"` when no match can be made.

## Inputs and Outputs

**Input: `TeamMember`**

| Field                | Type       | Description                         |
| -------------------- | ---------- | ----------------------------------- |
| `id`                 | `string`   | Unique identifier                   |
| `name`               | `string`   | Display name                        |
| `skills`             | `string[]` | Skill tags                          |
| `currentMeetingLoad` | `number`   | Meetings already assigned this week |
| `weeklyCapacity`     | `number`   | Max effort capacity per week        |

**Input: `Meeting`**

| Field            | Type          | Description                           |
| ---------------- | ------------- | ------------------------------------- |
| `id`             | `string`      | Unique identifier                     |
| `requiredSkills` | `string[]`    | Skills needed; empty means any member |
| `effort`         | `1 \| 2 \| 3` | Weight consumed from capacity         |
| `priority`       | `number`      | Higher values are processed first     |

**Output: `MeetingAssignment`**

| Field        | Type                                          | Description                 |
| ------------ | --------------------------------------------- | --------------------------- |
| `assigneeId` | `string \| null`                              | Assigned member id, or null |
| `status`     | `"assigned" \| "unassigned"`                  | Assignment outcome          |
| `reason`     | `"matched" \| "capacity" \| "skill_mismatch"` | Why assigned or not         |

See `types.ts`, `docs/ARCHITECTURE.md`, and `docs/DATA_OWNERSHIP.md` for the full architecture contract.
