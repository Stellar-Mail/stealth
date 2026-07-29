const ALICE_ID = "550e8400-e29b-41d4-a716-446655440001";
const BOB_ID = "550e8400-e29b-41d4-a716-446655440002";
const CHARLIE_ID = "550e8400-e29b-41d4-a716-446655440003";
const DIANA_ID = "550e8400-e29b-41d4-a716-446655440004";
const EVAN_ID = "550e8400-e29b-41d4-a716-446655440005";

import { describe, it, expect, beforeEach } from "vitest";
import {
  createAssignmentService,
  getThreadRequiredSpecialties,
} from "../services/assignment.service";
import { AGENT_FIXTURES, THREAD_FIXTURES } from "../fixtures/multi-agent.fixtures";

import {
  sanitizeAgentAssignments,
  validateAssignmentPayloadSize,
  AssignmentValidationError,
} from "../guards";

describe("Multi-Agent Assignment Service Tests", () => {
  let service: ReturnType<typeof createAssignmentService>;

  beforeEach(() => {
    service = createAssignmentService();
  });

  describe("Initialization", () => {
    it("should load the correct number of default agents", () => {
      expect(service.getAgents().length).toBe(5);
    });

    it("should load the correct number of default threads", () => {
      expect(service.getThreads().length).toBe(6);
    });

    it("should have zero logs initially", () => {
      expect(service.getLogs().length).toBe(0);
    });
  });

  describe("Specialty Deduction", () => {
    it("should deduce stellar specialties from subject/body text", () => {
      const thread = THREAD_FIXTURES.find((t) => t.id === "thread-001")!;
      const specs = getThreadRequiredSpecialties(thread);
      expect(specs).toContain("stellar");
    });

    it("should deduce security specialties from subject/body text", () => {
      const thread = THREAD_FIXTURES.find((t) => t.id === "thread-002")!;
      const specs = getThreadRequiredSpecialties(thread);
      expect(specs).toContain("security");
    });

    it("should deduce billing specialties from subject/body text", () => {
      const thread = THREAD_FIXTURES.find((t) => t.id === "thread-003")!;
      const specs = getThreadRequiredSpecialties(thread);
      expect(specs).toContain("billing");
    });

    it("should fallback to general if no terms match", () => {
      const dummyThread = {
        id: "dummy",
        subject: "Hello there",
        snippet: "Just checking in with you guys.",
        sender: "user@test.org",
        priority: "low" as const,
        assignedAgentIds: [],
        status: "unassigned" as const,
        date: new Date().toISOString(),
      };
      const specs = getThreadRequiredSpecialties(dummyThread);
      expect(specs).toEqual(["general"]);
    });
  });

  describe("Assign / Unassign Agent Operations", () => {
    it("should assign an agent to a thread", () => {
      // thread-005 is unassigned, agent-001 is active
      const updated = service.assignAgent("thread-005", ALICE_ID, "Operator A");
      expect(updated.assignedAgentIds).toContain(ALICE_ID);
      expect(updated.status).toBe("assigned");

      const agent = service.getAgents().find((a) => a.id === ALICE_ID)!;
      expect(agent.workload).toBe(3); // was 2 in fixtures

      expect(service.getLogs().length).toBe(1);
      expect(service.getLogs()[0].operator).toBe("Operator A");
      expect(service.getLogs()[0].action).toBe("assigned");
    });

    it("should be idempotent when assigning the same agent twice", () => {
      service.assignAgent("thread-005", ALICE_ID);
      const logsCountBefore = service.getLogs().length;

      // Assign again
      const updated = service.assignAgent("thread-005", ALICE_ID);
      expect(updated.assignedAgentIds.filter((id) => id === ALICE_ID).length).toBe(1);
      expect(service.getLogs().length).toBe(logsCountBefore); // No new log
    });

    it("should throw when assigning to a non-existent thread", () => {
      expect(() => service.assignAgent("non-existent", ALICE_ID)).toThrow(/not found/);
    });

    const UNKNOWN_AGENT = "550e8400-e29b-41d4-a716-446655449999";

    it("should throw when assigning a non-existent agent", () => {
      expect(() => service.assignAgent("thread-005", UNKNOWN_AGENT)).toThrow(/not found/i);
    });

    it("should unassign an agent from a thread", () => {
      // thread-001 has agent-003 assigned
      const updated = service.unassignAgent("thread-001", CHARLIE_ID, "Operator B");
      expect(updated.assignedAgentIds).not.toContain(CHARLIE_ID);
      expect(updated.status).toBe("unassigned"); // changed from assigned as list is empty

      const agent = service.getAgents().find((a) => a.id === CHARLIE_ID)!;
      expect(agent.workload).toBe(1); // was 2

      expect(service.getLogs().length).toBe(1);
      expect(service.getLogs()[0].operator).toBe("Operator B");
      expect(service.getLogs()[0].action).toBe("unassigned");
    });
  });

  describe("Agent Status & Workloads", () => {
    it("should update agent availability status", () => {
      const updated = service.updateAgentStatus(ALICE_ID, "offline");
      expect(updated.status).toBe("offline");
      expect(service.getAgents().find((a) => a.id === ALICE_ID)!.status).toBe("offline");
    });

    it("should resolve a thread, clearing assignments and updating workloads", () => {
      // thread-003 has agent-001 and agent-003 assigned (both workloads will drop)
      const thread = service.resolveThread("thread-003", "Supervisor");
      expect(thread.status).toBe("resolved");
      expect(thread.assignedAgentIds).toEqual([]);

      const alice = service.getAgents().find((a) => a.id === ALICE_ID)!;
      const charlie = service.getAgents().find((a) => a.id === CHARLIE_ID)!;
      expect(alice.workload).toBe(1); // was 2
      expect(charlie.workload).toBe(1); // was 2
    });
  });

  describe("Smart Match / Auto-Routing Engine", () => {
    it("should route to the agent with matching specialty and low workload", () => {
      // thread-006 is "Urgent Payout Escrow Lock-up" (Stellar category)
      // active agents: agent-001 (support, general, billing), agent-002 (security, compliance), agent-003 (stellar, billing, technical)
      // agent-003 is the only active agent with "stellar" specialty.
      const assigned = service.autoAssign("thread-006");
      expect(assigned.assignedAgentIds).toContain(CHARLIE_ID);
      expect(assigned.status).toBe("assigned");
      expect(service.getLogs()[0].operator).toBe("Auto-Routing Engine");
    });

    it("should choose active agent with lowest workload when no specialty matches", () => {
      // Mark agent-001 as busy so she is not considered (since she has 'general' specialty).
      service.updateAgentStatus(ALICE_ID, "busy");

      // Inject thread that matches 'general'
      const newThread = service.simulateIncomingThread(
        "Random Q",
        "How to use this system",
        "user@example.org",
        "low",
      );

      // Set agent workloads:
      // agent-002 workload = 1, agent-003 workload = 2
      // Neither matches 'general'. Bob (agent-002) has the lowest workload.
      const assigned = service.autoAssign(newThread.id);
      expect(assigned.assignedAgentIds).toContain(BOB_ID);
    });

    it("should bypass offline or busy agents", () => {
      // Let's make everyone offline except Alice (agent-001)
      service.updateAgentStatus(BOB_ID, "offline");
      service.updateAgentStatus(CHARLIE_ID, "offline");
      service.updateAgentStatus(DIANA_ID, "busy");
      service.updateAgentStatus(EVAN_ID, "offline");

      const newThread = service.simulateIncomingThread(
        "Security alert",
        "XSS attack check",
        "sec@test.org",
        "high",
      );

      // The best match specialty-wise is Bob (agent-002, security), but he is offline.
      // Alice (agent-001) is the only active agent left.
      const assigned = service.autoAssign(newThread.id);
      expect(assigned.assignedAgentIds).toContain(ALICE_ID);
    });

    it("should throw if no active agents are online", () => {
      // Put everyone offline
      service.updateAgentStatus(ALICE_ID, "offline");
      service.updateAgentStatus(BOB_ID, "offline");
      service.updateAgentStatus(CHARLIE_ID, "offline");
      service.updateAgentStatus(DIANA_ID, "offline");
      service.updateAgentStatus(EVAN_ID, "offline");

      expect(() => service.autoAssign("thread-005")).toThrow(/No active agents available/);
    });
  });

  describe("Metrics Calculations", () => {
    it("should calculate correct overview metrics", () => {
      const metrics = service.getMetrics();
      expect(metrics.totalThreads).toBe(6);
      expect(metrics.unassignedThreads).toBe(2);
      expect(metrics.assignedThreads).toBe(4);
      expect(metrics.totalAgents).toBe(5);
      expect(metrics.activeAgents).toBe(3); // Alice, Bob, Charlie are active
      expect(metrics.busyAgents).toBe(1); // Diana is busy
      expect(metrics.offlineAgents).toBe(1); // Evan is offline
      expect(metrics.averageWorkload).toBe(1); // (2+1+2+0+0) / 5 = 1.0
    });
  });
});

describe("Assignment Guards", () => {
  it("accepts valid UUID agent IDs", () => {
    const ids = ["123e4567-e89b-42d3-a456-426614174000", "987e6543-e21b-42d3-a456-426614174001"];

    expect(sanitizeAgentAssignments(ids)).toEqual(ids);
  });

  it("removes duplicate UUID agent IDs", () => {
    const id = "123e4567-e89b-42d3-a456-426614174000";

    expect(sanitizeAgentAssignments([id, id, id])).toEqual([id]);
  });

  it("rejects invalid UUIDs", () => {
    expect(() => sanitizeAgentAssignments(["agent-001"])).toThrow(AssignmentValidationError);
  });

  it("rejects more than ten agent IDs", () => {
    const ids = Array.from({ length: 11 }, (_, index) => {
      return `123e4567-e89b-42d3-a456-${String(index).padStart(12, "0")}`;
    });

    expect(() => sanitizeAgentAssignments(ids)).toThrow(AssignmentValidationError);
  });

  it("rejects oversized assignment payloads", () => {
    expect(() =>
      validateAssignmentPayloadSize({
        subject: "Large payload",
        body: "A".repeat(6000),
      }),
    ).toThrow(AssignmentValidationError);
  });
});
