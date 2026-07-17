# Multi-Agent Assignment — Architecture Contract

## Ownership Boundary

**All work for this tool is isolated within:**

```
tools/v2/team/multi-agent-assignment/
```

**Sacred constraints — these must NOT be modified by this issue or any follow-up PR:**

- Main application shell, dashboard layout, navigation system
- Main app routing (`src/router.tsx`, `src/routes/`)
- Inbox architecture, mail rendering engine
- Authentication and wallet core
- Stellar integration core
- Database schema and persistence
- Shared design system (`src/components/ui/`)
- Existing feature modules (`src/features/`)

This tool is a **self-contained V2 later-release team tool**. Future integration with the main mail app is a separate issue.

---

## Module Architecture

### Folder Structure

```
tools/v2/team/multi-agent-assignment/
├── index.ts                          # Public barrel export
├── types/
│   └── index.ts                      # Domain type definitions
├── services/
│   └── assignment.service.ts         # Assignment engine (core business logic)
├── hooks/
│   └── use-multi-agent-assignment.ts # React state management hook
├── components/
│   ├── AssignmentConsole.tsx         # Main workspace orchestrator
│   ├── ThreadList.tsx                # Thread queue and assignment UI
│   ├── AgentList.tsx                 # Agent roster and status UI
│   └── index.ts                      # Component barrel export
├── fixtures/
│   └── multi-agent.fixtures.ts       # Seed data for tests and demo
├── tests/
│   ├── assignment.test.ts            # Vitest unit tests
│   └── test-plan.md                  # Test coverage documentation
├── docs/
│   ├── ARCHITECTURE.md               # Technical deep dive (routing algorithm)
│   ├── ACCESSIBILITY.md              # a11y design notes
│   ├── README.md                     # Setup and getting started
│   └── review-notes.md               # Reviewer checklist
├── demo.tsx                          # Self-contained development harness
├── vitest.config.ts                  # Isolated test runner config
├── README.md                         # Tool overview
├── ARCHITECTURE.md                   # This file
└── specs.md                          # Feature specs and contracts
```

### Module Boundaries

#### 1. **types/index.ts** — Data Model

**Responsibility:** Define all data shapes and input/output contracts.

**Exports:**

- `Agent` — team member available for assignment
- `Thread` — inbox conversation/ticket in the queue
- `AssignmentLog` — audit trail entry for assignment actions
- `AssignmentMetrics` — aggregate workspace statistics

**Rules:**

- Pure TypeScript types, no logic.
- All fields are required unless explicitly optional (`category?`).
- Timestamps are ISO 8601 strings (not Date objects).
- Multi-agent support via `assignedAgentIds: string[]`.
- Do not add references to main app types or services.

---

#### 2. **services/assignment.service.ts** — Assignment Engine

**Responsibility:** Implement routing logic, workload tracking, and in-memory state management.

**Public Factory:**

```ts
createAssignmentService(
  initialAgents?: Agent[],
  initialThreads?: Thread[],
)
```

**Public Methods (returned by factory):**

| Method                                        | Purpose                                 |
| --------------------------------------------- | --------------------------------------- |
| `getAgents()`                                 | Return current agent roster             |
| `getThreads()`                                | Return current thread queue             |
| `getLogs()`                                   | Return assignment audit log             |
| `assignAgent(threadId, agentId, operator?)`   | Manually assign agent to thread         |
| `unassignAgent(threadId, agentId, operator?)` | Remove agent from thread                |
| `updateAgentStatus(agentId, status)`          | Change agent availability               |
| `resolveThread(threadId, operator?)`          | Mark thread resolved, clear assignments |
| `autoAssign(threadId)`                        | Smart-route thread to best agent        |
| `simulateIncomingThread(...)`                 | Add a new unassigned thread             |
| `getMetrics()`                                | Compute aggregate workspace metrics     |

**Pure Utility Exports:**

- `getThreadRequiredSpecialties(thread)` — deduce required skills from thread text
- `computeMetrics(agents, threads)` — calculate metrics from snapshots

**Implementation Contract:**

- Storage: in-memory arrays — no persistence.
- All mutations are synchronous; the hook layer handles React re-renders.
- Assign/unassign operations are idempotent (no duplicate logs).
- Auto-routing considers only agents with `status: "active"`.
- Workload increments on assign, decrements on unassign/resolve.
- No network calls, no database access, no side effects outside the store.

**Rules:**

- Do not add authentication or authorization checks.
- Do not add real-time sync or WebSocket listeners.
- Do not integrate with main app services or stores.
- Do not add persistence (deferred to future issue).

---

#### 3. **hooks/use-multi-agent-assignment.ts** — React State Hook

**Responsibility:** Bridge the assignment service to React component state.

**Returns:**

- State: `agents`, `threads`, `logs`, `metrics`
- Actions: `assignAgent`, `unassignAgent`, `updateAgentStatus`, `resolveThread`, `autoAssign`, `autoAssignAllUnassigned`, `simulateIncomingThread`

**Implementation Contract:**

- Creates a single `createAssignmentService()` instance via `useState` initializer.
- Syncs React state after every service mutation via `syncState()`.
- `metrics` is memoized from agent/thread state.
- `autoAssignAllUnassigned` batch-routes all unassigned threads, collecting errors.

**Rules:**

- Do not import from main app hooks or stores.
- Do not add side effects beyond service sync.
- Do not expose the raw service instance to consumers.

---

#### 4. **components/** — UI Presentation Layer

**Responsibility:** Render the assignment workspace and handle user interactions.

| Component           | Role                                                         |
| ------------------- | ------------------------------------------------------------ |
| `AssignmentConsole` | Top-level orchestrator; binds hook state to child components |
| `ThreadList`        | Thread queue with search, filters, assign/unassign controls  |
| `AgentList`         | Agent roster cards with status and workload display          |

**Rules:**

- Components consume state exclusively via `useMultiAgentAssignment` hook.
- No direct service imports in components.
- No imports from main app design system (uses inline styles for isolation).
- No routing or navigation logic.

---

#### 5. **index.ts** — Public Barrel Export

**Responsibility:** Define the public API surface.

**What is exported:**

- `createAssignmentService` factory
- `useMultiAgentAssignment` hook
- `AgentList`, `ThreadList`, `AssignmentConsole` components
- `Agent`, `Thread`, `AssignmentLog`, `AssignmentMetrics` types

**What is NOT exported:**

- Internal utility functions (`getThreadRequiredSpecialties`, `computeMetrics`)
- Fixture data (not part of public API)
- Demo harness (`demo.tsx`)

**Rules:**

- All public exports are documented via TypeScript types.
- Do not re-export from external libraries.
- This is the only file external consumers should import from.

---

### Data Ownership

| Module                                | Owns            | Responsible For                    |
| ------------------------------------- | --------------- | ---------------------------------- |
| `types/index.ts`                      | Data shapes     | Defining all contracts             |
| `services/assignment.service.ts`      | In-memory store | Routing, CRUD, workload tracking   |
| `hooks/use-multi-agent-assignment.ts` | React state     | Syncing service to UI              |
| `components/`                         | Presentation    | User interaction and display       |
| `fixtures/multi-agent.fixtures.ts`    | Test data       | Deterministic seed data            |
| `tests/`                              | Test coverage   | Validating all contract guarantees |

### Data Flow

```
User Interaction (components/)
    ↓
[hooks/use-multi-agent-assignment.ts] — React state bridge
    ↓
[services/assignment.service.ts] — business logic, store mutation
    ↓
Internal Store (agents[], threads[], logs[])
    ↓
[hooks/use-multi-agent-assignment.ts] — syncState() copies to React
    ↓
UI Re-render (components/)
```

---

### Dependencies

#### Internal Dependencies (within this folder)

```
services/assignment.service.ts
  ├─→ types/index.ts
  └─→ fixtures/multi-agent.fixtures.ts (default seed data)

hooks/use-multi-agent-assignment.ts
  ├─→ services/assignment.service.ts
  └─→ types/index.ts

components/
  ├─→ hooks/use-multi-agent-assignment.ts
  └─→ types/index.ts

index.ts
  ├─→ services/assignment.service.ts
  ├─→ hooks/use-multi-agent-assignment.ts
  ├─→ components/index.ts
  └─→ types/index.ts

tests/assignment.test.ts
  ├─→ services/assignment.service.ts
  └─→ fixtures/multi-agent.fixtures.ts
```

#### External Dependencies

**Allowed:**

- TypeScript (type system)
- React (`useState`, `useMemo`, `useCallback`) — hook and component layers only
- Vitest — test runner

**Not allowed:**

- Main app imports (`src/`, relative paths outside this folder)
- Shared design system (`src/components/ui/`)
- External npm libraries beyond React and Vitest
- Browser APIs for persistence or network
- Database or Stellar integration libraries

---

### Integration Constraints

#### What This Tool Cannot Do (by design)

1. **No persistence** — in-memory only.
2. **No authentication** — caller is trusted.
3. **No authorization** — all agents see all threads.
4. **No database schema** — no schema dependencies.
5. **No main app integration** — isolated tool.
6. **No Stellar interaction** — no wallet, no blockchain.
7. **No real-time features** — no WebSocket, no server push.
8. **No shared design system** — self-contained styling.

#### Future Integration Points (separate issue)

A future integration issue may add:

- **Main app routing** — register tool in team tools section
- **Inbox thread sync** — connect `Thread` model to real mail threads
- **Agent roster sync** — connect `Agent` model to team member directory
- **Persistence layer** — sync in-memory store to API or database
- **Design system adoption** — replace inline styles with shared UI components

---

## Design Principles

### 1. Isolation First

- No modifications to files outside this folder.
- No imports from `src/` or other tool folders.
- Self-contained, copy-paste-able mini-product.

### 2. Specialty-Aware Routing

- Thread text is scanned for domain keywords to deduce required specialties.
- Auto-routing prioritizes specialty match count, then lowest workload.
- Only `active` agents are eligible for auto-assignment.

### 3. Multi-Agent Support

- Threads support multiple simultaneous assignees via `assignedAgentIds[]`.
- Workload tracks per-agent assignment count independently.
- Unassigning the last agent reverts thread to `unassigned` status.

### 4. Audit Trail

- Every assign, unassign, auto-route, and resolve action creates an `AssignmentLog` entry.
- Logs include operator identity and timestamp for accountability.

### 5. No Hidden Dependencies

- No globals, no singletons.
- All dependencies are explicit and folder-local.

---

## Testing Strategy

### Fixture-Based Testing

- All tests use deterministic seed data from `fixtures/multi-agent.fixtures.ts`.
- Fixtures include 5 agents (varied status/specialties) and 6 threads (varied assignment states).
- Same fixtures used in all test suites and the demo harness.

### Coverage

| Category            | Scenario                                               | Test File            |
| ------------------- | ------------------------------------------------------ | -------------------- |
| Initialization      | Default agents, threads, empty logs                    | `assignment.test.ts` |
| Specialty deduction | Stellar, security, billing, general fallback           | `assignment.test.ts` |
| Manual assignment   | Assign, idempotent re-assign, not-found errors         | `assignment.test.ts` |
| Unassignment        | Unassign, status revert, workload decrement            | `assignment.test.ts` |
| Agent status        | Update availability status                             | `assignment.test.ts` |
| Resolution          | Resolve thread, clear assignments, decrement workloads | `assignment.test.ts` |
| Auto-routing        | Specialty match, workload fallback, offline bypass     | `assignment.test.ts` |
| Metrics             | Aggregate counts and averages                          | `assignment.test.ts` |

### Test Execution

```bash
npx vitest -c tools/v2/team/multi-agent-assignment/vitest.config.ts run
```

---

## Contribution Guidelines

### What Contributors Can Change

**Allowed:**

- Add new tests to `tests/assignment.test.ts`.
- Add new fixtures to `fixtures/multi-agent.fixtures.ts`.
- Optimize service internals (same public API).
- Add new components within `components/` (same hook contract).
- Update documentation (`*.md` files in this folder).
- Extend specialty keyword lists in `getThreadRequiredSpecialties`.

### What Contributors Cannot Change

**Not allowed:**

- Modify public method signatures on the service factory return type.
- Change data type shapes in `types/index.ts` without prior issue discussion.
- Import from `src/` or other tool folders.
- Modify main app files (`src/`, `routes/`, `components/`, etc.).
- Add external npm dependencies.
- Add authentication, authorization, or persistence (deferred to future issues).
- Wire this tool into main app routing or shell (deferred to separate issue).

### Code Review Checklist

Reviewers must verify:

- [ ] All changes are within `tools/v2/team/multi-agent-assignment/`
- [ ] No imports from `src/` or other folders
- [ ] No new external npm dependencies
- [ ] Public API (method signatures, type shapes) unchanged
- [ ] All tests pass: `npx vitest -c tools/v2/team/multi-agent-assignment/vitest.config.ts run`
- [ ] Documentation is updated (`ARCHITECTURE.md`, `specs.md`, `test-plan.md`)
- [ ] Auto-routing respects agent status and specialty matching
- [ ] No main app side effects

---

## Acceptance Criteria Checklist

- ✅ Tool has a clear folder-local architecture plan (this document)
- ✅ Issue work does not modify main app shell, routing, inbox, wallet, Stellar, or design system
- ✅ Specs explain what future contributors may and may not change (see above)
- ✅ Files changed by this issue are limited to `tools/v2/team/multi-agent-assignment/`
- ✅ Contribution is reviewable as a self-contained mini-product

---

## File Ownership Map

| File                                  | Module        | Owner        | Type      |
| ------------------------------------- | ------------- | ------------ | --------- |
| `types/index.ts`                      | Data Model    | Service Team | Stable    |
| `services/assignment.service.ts`      | Core Service  | Service Team | Stable    |
| `hooks/use-multi-agent-assignment.ts` | React Hook    | UI Team      | Stable    |
| `components/*.tsx`                    | UI Layer      | UI Team      | Mutable   |
| `index.ts`                            | Public API    | Service Team | Stable    |
| `specs.md`                            | Specification | Service Team | Reference |
| `ARCHITECTURE.md`                     | Architecture  | Service Team | Reference |
| `README.md`                           | Overview      | Service Team | Reference |
| `docs/review-notes.md`                | Review Guide  | Service Team | Reference |
| `fixtures/multi-agent.fixtures.ts`    | Test Data     | QA Team      | Mutable   |
| `tests/assignment.test.ts`            | Test Suite    | QA Team      | Mutable   |
| `tests/test-plan.md`                  | Test Plan     | QA Team      | Reference |

---

## Version History

| Date       | Status  | Notes                                                     |
| ---------- | ------- | --------------------------------------------------------- |
| 2026-06-20 | Initial | Created architecture contract for V2 release (issue #634) |
