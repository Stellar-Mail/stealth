# Architecture and Folder Contract - Multi-Agent Assignment

**Issue**: #634  
**Release Tier**: V2  
**Audience**: Team  
**Folder Ownership**: `tools/v2/team/multi-agent-assignment/`

---

## 1. Executive Summary & Design Scope

The Multi-Agent Assignment tool is a V2 team-level workflow component designed to handle manual, specialty-aware automatic, and workload-balanced routing of incoming communications (inbox threads) to multiple collaborators.

To ensure long-term maintainability, this tool is built as an **isolated, self-contained mini-product**. It establishes a strict folder contract boundary, preventing any tight coupling with the main application core (routing, inbox database, global state, authentication, Stellar integration core, or global design systems).

---

## 2. Campaign Labels & Metadata

This issue belongs to the following campaigns and must carry these identifiers:

- `GrantFox OSS`
- `Maybe Rewarded`
- `Official Campaign`
- `Tooling Ecosystem`
- `V2 Later Tool`
- `Team Tool`

---

## 3. Module Boundaries & Folder Contract

All source code, configuration files, and assets for this feature reside inside `tools/v2/team/multi-agent-assignment/`. Future contributors must adhere to the following internal boundaries:

```
tools/v2/team/multi-agent-assignment/
├── types/
│   └── index.ts                      # Domain-specific typescript types
├── services/
│   └── assignment.service.ts         # Pure business logic and in-memory store
├── hooks/
│   └── use-multi-agent-assignment.ts # State bridge hook for React
├── components/
│   ├── AssignmentConsole.tsx         # Root workspace view
│   ├── ThreadList.tsx                # Queued threads list and manually assigned components
│   ├── AgentList.tsx                 # Team roster and status controls
│   └── index.ts                      # Barrel exports
├── fixtures/
│   └── multi-agent.fixtures.ts       # Test seed data
├── tests/
│   ├── assignment.test.ts            # Vitest unit test suite
│   └── test-plan.md                  # Test coverage blueprint
├── docs/
│   ├── ARCHITECTURE.md               # Technical Deep Dive
│   ├── ACCESSIBILITY.md              # Accessible elements (a11y)
│   ├── README.md                     # Getting started guides
│   └── review-notes.md               # Reviewer checklists
├── demo.tsx                          # Self-contained preview entry point
├── vitest.config.ts                  # Isolated vitest runner configuration
└── ARCHITECTURE.md                   # Authoritative architecture contract
```

### Module Responsibilities:

1. **Types Layer (`types/index.ts`)**: Pure TypeScript contracts. Contains no runtime code. Exposes core schemas (`Agent`, `Thread`, `AssignmentLog`, `AssignmentMetrics`).
2. **Service Layer (`services/assignment.service.ts`)**: The business engine. Fully synchronous, in-memory array operations. Evaluates agent scores and manages state updates.
3. **Hooks Layer (`hooks/use-multi-agent-assignment.ts`)**: The state coordinator. Binds the synchronous service state to the React lifecycle using local React state and callbacks.
4. **Components Layer (`components/`)**: Visual representation. Consumes properties strictly from the hook, relying on inline styles for visual isolation from the global CSS framework.
5. **Fixtures Layer (`fixtures/multi-agent.fixtures.ts`)**: Seed files used identically in testing and local demos to guarantee absolute determinism.

---

## 4. Data Ownership & Unidirectional Flow

The architecture operates on a unidirectional state update loop.

```
Component User Actions (Click Resolve, Auto-Assign)
   │
   ▼
useMultiAgentAssignment Hook Action Handlers
   │
   ▼
createAssignmentService API Mutator
   │
   ▼
In-Memory Store Updated (agents, threads, logs)
   │
   ▼
syncState() called (Dispatches array clones)
   │
   ▼
React State re-renders components
```

- **In-Memory Store**: Dictates the truth of the system.
- **Idempotency**: Assignment/unassignment operations check current status before logging. Repeated operations return immediately, preventing duplicate logs or side effects.

---

## 5. Dependency Rules & Integration Constraints

To preserve the release tier decoupling, strict dependency limits are enforced:

### Allowed External Dependencies

- `react` (`useState`, `useMemo`, `useCallback`)
- `vitest` (Testing framework)

### Disallowed Dependencies (Strict Boundaries)

- **No imports** from the main app root (`src/components/ui/`, `src/features/`, `src/routes/`).
- **No network calls** or WebSockets.
- **No storage persistence** (e.g., LocalStorage, IndexedDB, or SQL databases).
- **No shared styling frameworks** (components use isolated CSS/inline styles).

### What Future Contributors May Change

- Refactor/optimize algorithms in `services/assignment.service.ts` (as long as public method signatures remain identical).
- Add new local UI components inside the `components/` subdirectory.
- Add additional test cases or local fixtures.
- Adjust specialty keywords list to improve routing accuracy.

### What Future Contributors May NOT Change

- Modify public contracts in `types/index.ts` without formal architectural review.
- Break the directory isolation by importing code from outside this directory.
- Wire this tool directly into the core navigation or router system (must remain isolated under `tools/`).

---

## 6. Algorithmic Complexity Profile

Below is the time and space complexity design analysis of all operations within `createAssignmentService`:

| Operation                              | Time Complexity       | Space Complexity | Description / Rationale                                                                                                                                  |
| :------------------------------------- | :-------------------- | :--------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getAgents` / `getThreads` / `getLogs` | $O(1)$                | $O(1)$           | Direct access to in-memory array references.                                                                                                             |
| `getThreadRequiredSpecialties`         | $O(N)$                | $O(1)$           | $N$ is the length of the parsed thread subject, snippet, and category text. Scanned via string-contains matches. Max return size is bounded ($S \le 5$). |
| `computeMetrics`                       | $O(A + T)$            | $O(1)$           | Single pass over agents ($A$) and threads ($T$) to count attributes. Bounded accumulator footprint.                                                      |
| `assignAgent` / `unassignAgent`        | $O(A + T)$            | $O(A + T)$       | Array search to locate entities: $O(A)$ and $O(T)$ operations. Emits copied arrays to trigger React component updates.                                   |
| `updateAgentStatus`                    | $O(A)$                | $O(A)$           | Traverses agent array ($A$) to find target agent and clones state.                                                                                       |
| `resolveThread`                        | $O(A + T)$            | $O(A + T)$       | Marks thread resolved ($O(T)$), finds its assignees, and decrements workload counters ($O(A)$).                                                          |
| `autoAssign`                           | $O(A \log A + T + N)$ | $O(A)$           | Matches specialties ($O(N)$), scores active agents, sorts candidates ($O(A \log A)$), and updates the matching entity state ($O(A+T)$).                  |

---

## 7. Stellar Integration Alignment

While this tool is decoupled from real chain calls, it is designed with Stellar ledger concepts and Freighter wallet properties in mind:

1. **Specialty Keyphrase Matching**: Automatically associates inbox threads containing "Stellar", "Freighter", "Escrow", and "Blockchain" with agents holding `stellar` credentials (e.g., matching Freighter wallet support queues to specialized engineers).
2. **Transaction Escrow Workloads**: Auto-routing prioritizes active, low-workload agents for complex escrow-related issues, minimizing response latency.
3. **Freighter API Error Resolution**: Predefined categorizations map freighter errors to the `technical` and `stellar` agent queues automatically.

---

## 8. Verification & QA Plan

### Automated Execution

Unit tests run in an isolated test runner instance. Verify all 19 test conditions:

```bash
npx vitest -c tools/v2/team/multi-agent-assignment/vitest.config.ts run
```

### Reviewer Acceptance Checklist

- [ ] All changes are contained within the `tools/v2/team/multi-agent-assignment/` directory.
- [ ] No imports cross the boundary to the `src/` core directory.
- [ ] The `architecture-and-folder-contract.md` is registered in the workspace.
- [ ] The engine executes auto-routing deterministically based on specialties and workload balancing.
