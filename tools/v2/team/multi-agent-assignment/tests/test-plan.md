# Multi-Agent Assignment — Test Plan

Executable tests are in `tests/assignment.test.ts`. This document describes the coverage.

## Fixture Setup

Use `fixtures/multi-agent.fixtures.ts` — contains 5 agents and 6 threads:

| Agent ID  | Name         | Status  | Specialties                    | Workload |
| --------- | ------------ | ------- | ------------------------------ | -------- |
| agent-001 | Alice Vance  | active  | support, general, billing      | 2        |
| agent-002 | Bob Chen     | active  | security, compliance           | 1        |
| agent-003 | Charlie Kim  | active  | stellar, billing, technical    | 2        |
| agent-004 | Diana Prince | busy    | technical, escalation, support | 0        |
| agent-005 | Evan Wright  | offline | support, general               | 0        |

| Thread ID  | Subject                      | Status     | Assigned Agents      |
| ---------- | ---------------------------- | ---------- | -------------------- |
| thread-001 | Stellar Escrow Issue         | assigned   | agent-003            |
| thread-002 | Suspicious Login Alert       | assigned   | agent-002            |
| thread-003 | Invoice Discrepancy          | assigned   | agent-001, agent-003 |
| thread-004 | General Support Request      | assigned   | agent-001            |
| thread-005 | API Integration Failure      | unassigned | —                    |
| thread-006 | Urgent Payout Escrow Lock-up | unassigned | —                    |

## Scenarios

| Scenario                   | Test                         | Expected Result                                               |
| -------------------------- | ---------------------------- | ------------------------------------------------------------- |
| Load default agents        | Initialization > agents      | 5 agents loaded                                               |
| Load default threads       | Initialization > threads     | 6 threads loaded                                              |
| Empty logs on init         | Initialization > logs        | 0 log entries                                                 |
| Deduce stellar specialty   | Specialty > thread-001       | Contains "stellar"                                            |
| Deduce security specialty  | Specialty > thread-002       | Contains "security"                                           |
| Deduce billing specialty   | Specialty > thread-003       | Contains "billing"                                            |
| Fallback to general        | Specialty > no keywords      | Returns `["general"]`                                         |
| Assign agent to thread     | Assign > thread-005          | Status becomes "assigned", workload +1                        |
| Idempotent re-assign       | Assign > same agent twice    | No duplicate log entry                                        |
| Assign non-existent thread | Assign > bad threadId        | Throws "not found"                                            |
| Assign non-existent agent  | Assign > bad agentId         | Throws "not found"                                            |
| Unassign agent             | Unassign > thread-001        | Agent removed, status reverts if empty                        |
| Update agent status        | Status > agent-001 offline   | Status updated in store                                       |
| Resolve thread             | Resolve > thread-003         | Status "resolved", assignments cleared, workloads decremented |
| Auto-route stellar thread  | Auto-route > thread-006      | Routes to agent-003 (stellar specialty)                       |
| Workload fallback routing  | Auto-route > general thread  | Routes to lowest-workload active agent                        |
| Bypass offline agents      | Auto-route > security thread | Skips offline agents, routes to active                        |
| No active agents           | Auto-route > all offline     | Throws "No active agents available"                           |
| Metrics calculation        | Metrics > default state      | Correct counts and averages                                   |

## Negative Checks

- Fresh service initializes with zero logs.
- Assign to resolved thread throws error.
- Auto-assign to resolved thread throws error.
- Duplicate assign/unassign operations are idempotent.
- Workload never goes below zero.

## Running

```bash
npx vitest -c tools/v2/team/multi-agent-assignment/vitest.config.ts run
```
