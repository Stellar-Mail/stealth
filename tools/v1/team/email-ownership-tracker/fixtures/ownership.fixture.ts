import type { OwnershipEvent } from "../services/ownership.service";

export const FIXTURE_OWNERSHIP_EVENTS: OwnershipEvent[] = [
  {
    id: "ownership_thread-100_2026-06-20T09:00:00.000Z",
    threadId: "thread-100",
    ownerId: "agent-alice",
    actorId: "lead-marta",
    action: "assigned",
    reason: "Initial triage",
    note: "Customer asks about account recovery.",
    createdAt: "2026-06-20T09:00:00.000Z",
  },
  {
    id: "ownership_thread-100_2026-06-20T10:00:00.000Z",
    threadId: "thread-100",
    ownerId: "agent-bob",
    actorId: "agent-alice",
    action: "transferred",
    reason: "Escalation",
    note: "Needs billing specialist follow-up.",
    createdAt: "2026-06-20T10:00:00.000Z",
  },
  {
    id: "ownership_thread-200_2026-06-20T11:00:00.000Z",
    threadId: "thread-200",
    ownerId: "agent-carol",
    actorId: "agent-carol",
    action: "claimed",
    reason: "Queue pickup",
    note: "New inbound enterprise question.",
    createdAt: "2026-06-20T11:00:00.000Z",
  },
];
