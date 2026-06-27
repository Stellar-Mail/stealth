# Multi-Agent Assignment Specs

## Purpose

Provide a team workspace for assigning multiple collaborators to inbox threads.
Supports manual assignment, smart auto-routing based on agent specialties and
workload balancing, and an audit trail of all assignment actions.

## Input Contract

### Agent

```ts
interface Agent {
  id: string;
  name: string;
  role: string;
  email: string;
  status: "active" | "busy" | "offline";
  workload: number;
  specialties: string[];
  avatar: string;
}
```

### Thread

```ts
interface Thread {
  id: string;
  subject: string;
  snippet: string;
  sender: string;
  priority: "low" | "medium" | "high";
  assignedAgentIds: string[];
  status: "unassigned" | "assigned" | "resolved";
  category?: string;
  date: string; // ISO 8601
}
```

## Output Contract

### AssignmentLog

```ts
interface AssignmentLog {
  id: string;
  threadId: string;
  threadSubject: string;
  agentId: string;
  agentName: string;
  action: "assigned" | "unassigned" | "auto-routed";
  timestamp: string; // ISO 8601
  operator: string;
}
```

### AssignmentMetrics

```ts
interface AssignmentMetrics {
  totalThreads: number;
  unassignedThreads: number;
  assignedThreads: number;
  resolvedThreads: number;
  totalAgents: number;
  activeAgents: number;
  busyAgents: number;
  offlineAgents: number;
  averageWorkload: number;
}
```

### Errors

| Error            | Condition                         | Shape                                               |
| ---------------- | --------------------------------- | --------------------------------------------------- |
| Thread not found | Invalid `threadId`                | `Error: Thread {id} not found.`                     |
| Agent not found  | Invalid `agentId`                 | `Error: Agent {id} not found.`                      |
| Thread resolved  | Assign to resolved thread         | `Error: Thread {id} is already resolved.`           |
| No active agents | Auto-assign with no active agents | `Error: No active agents available for assignment.` |

## Service Operations

| Operation                | Input                                                   | Output              | Error                                        |
| ------------------------ | ------------------------------------------------------- | ------------------- | -------------------------------------------- |
| `assignAgent`            | `threadId`, `agentId`, `operator?`                      | `Thread`            | Thread/Agent not found, resolved thread      |
| `unassignAgent`          | `threadId`, `agentId`, `operator?`                      | `Thread`            | Thread/Agent not found                       |
| `updateAgentStatus`      | `agentId`, `status`                                     | `Agent`             | Agent not found                              |
| `resolveThread`          | `threadId`, `operator?`                                 | `Thread`            | Thread not found                             |
| `autoAssign`             | `threadId`                                              | `Thread`            | Thread not found, resolved, no active agents |
| `simulateIncomingThread` | `subject`, `snippet`, `sender`, `priority`, `category?` | `Thread`            | —                                            |
| `getMetrics`             | —                                                       | `AssignmentMetrics` | —                                            |

## Auto-Routing Algorithm

1. Deduce required specialties from thread subject, snippet, and category text.
2. Filter to agents with `status: "active"`.
3. Score each candidate by specialty match count.
4. Sort by match count (descending), then workload (ascending).
5. Assign to top candidate with operator `"Auto-Routing Engine"`.

### Specialty Keywords

| Specialty | Keywords                               |
| --------- | -------------------------------------- |
| stellar   | stellar, blockchain, freighter, escrow |
| security  | security, login, anomalous, hack, xss  |
| billing   | billing, invoice, discrepancy, finance |
| technical | api, gateway, technical, error, 502    |
| support   | support, help, question, feedback      |
| general   | (fallback when no keywords match)      |

## Determinism Guarantees

- Same seed data produces identical initial state.
- Assign/unassign are idempotent — duplicate operations produce no new logs.
- Auto-routing with identical agent/thread state always selects the same agent.
- Specialty deduction is deterministic for the same thread text.
- Metrics calculations are pure functions of current agent/thread snapshots.

## Hook Contract

`useMultiAgentAssignment()` returns:

| Field                     | Type                                                      | Description               |
| ------------------------- | --------------------------------------------------------- | ------------------------- |
| `agents`                  | `Agent[]`                                                 | Current agent roster      |
| `threads`                 | `Thread[]`                                                | Current thread queue      |
| `logs`                    | `AssignmentLog[]`                                         | Assignment audit trail    |
| `metrics`                 | `AssignmentMetrics`                                       | Aggregate statistics      |
| `assignAgent`             | `(threadId, agentId, operator?) => void`                  | Manual assignment         |
| `unassignAgent`           | `(threadId, agentId, operator?) => void`                  | Remove assignment         |
| `updateAgentStatus`       | `(agentId, status) => void`                               | Change availability       |
| `resolveThread`           | `(threadId, operator?) => void`                           | Mark resolved             |
| `autoAssign`              | `(threadId) => void`                                      | Smart-route single thread |
| `autoAssignAllUnassigned` | `() => { count, errors }`                                 | Batch auto-route          |
| `simulateIncomingThread`  | `(subject, snippet, sender, priority, category?) => void` | Add thread                |

## Test Fixtures

Use `fixtures/multi-agent.fixtures.ts` as the baseline seed set. It covers:

- 5 agents with varied status (3 active, 1 busy, 1 offline) and specialties
- 6 threads with varied assignment states (2 unassigned, 4 assigned, 0 resolved initially)
- Edge cases for specialty deduction (stellar, security, billing threads)
- Workload distribution for balancing tests

## Review Expectations

Reviewers should verify:

1. All changes stay inside `tools/v2/team/multi-agent-assignment/`.
2. No network calls, persistence, or production dependencies exist.
3. Every service operation has test coverage for success and error paths.
4. Auto-routing respects agent status and specialty matching.
5. The public API surface is limited to what `index.ts` exports.
6. Architecture contract in `ARCHITECTURE.md` is accurate and complete.
