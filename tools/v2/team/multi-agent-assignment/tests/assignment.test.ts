import { describe, it, expect, beforeEach } from "vitest";
import {
  createAssignmentService,
  getThreadRequiredSpecialties,
} from "../services/assignment.service";
import { AGENT_FIXTURES, THREAD_FIXTURES } from "../fixtures/multi-agent.fixtures";

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
      const updated = service.assignAgent("thread-005", "agent-001", "Operator A");
      expect(updated.assignedAgentIds).toContain("agent-001");
      expect(updated.status).toBe("assigned");

      const agent = service.getAgents().find((a) => a.id === "agent-001")!;
      expect(agent.workload).toBe(3); // was 2 in fixtures

      expect(service.getLogs().length).toBe(1);
      expect(service.getLogs()[0].operator).toBe("Operator A");
      expect(service.getLogs()[0].action).toBe("assigned");
    });

    it("should be idempotent when assigning the same agent twice", () => {
      service.assignAgent("thread-005", "agent-001");
      const logsCountBefore = service.getLogs().length;

      // Assign again
      const updated = service.assignAgent("thread-005", "agent-001");
      expect(updated.assignedAgentIds.filter((id) => id === "agent-001").length).toBe(1);
      expect(service.getLogs().length).toBe(logsCountBefore); // No new log
    });

    it("should throw when assigning to a non-existent thread", () => {
      expect(() => service.assignAgent("non-existent", "agent-001")).toThrow(/not found/);
    });

    it("should throw when assigning a non-existent agent", () => {
      expect(() => service.assignAgent("thread-005", "non-existent")).toThrow(/not found/);
    });

    it("should unassign an agent from a thread", () => {
      // thread-001 has agent-003 assigned
      const updated = service.unassignAgent("thread-001", "agent-003", "Operator B");
      expect(updated.assignedAgentIds).not.toContain("agent-003");
      expect(updated.status).toBe("unassigned"); // changed from assigned as list is empty

      const agent = service.getAgents().find((a) => a.id === "agent-003")!;
      expect(agent.workload).toBe(1); // was 2

      expect(service.getLogs().length).toBe(1);
      expect(service.getLogs()[0].operator).toBe("Operator B");
      expect(service.getLogs()[0].action).toBe("unassigned");
    });
  });

  describe("Agent Status & Workloads", () => {
    it("should update agent availability status", () => {
      const updated = service.updateAgentStatus("agent-001", "offline");
      expect(updated.status).toBe("offline");
      expect(service.getAgents().find((a) => a.id === "agent-001")!.status).toBe("offline");
    });

    it("should resolve a thread, clearing assignments and updating workloads", () => {
      // thread-003 has agent-001 and agent-003 assigned (both workloads will drop)
      const thread = service.resolveThread("thread-003", "Supervisor");
      expect(thread.status).toBe("resolved");
      expect(thread.assignedAgentIds).toEqual([]);

      const alice = service.getAgents().find((a) => a.id === "agent-001")!;
      const charlie = service.getAgents().find((a) => a.id === "agent-003")!;
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
      expect(assigned.assignedAgentIds).toContain("agent-003");
      expect(assigned.status).toBe("assigned");
      expect(service.getLogs()[0].operator).toBe("Auto-Routing Engine");
    });

    it("should choose active agent with lowest workload when no specialty matches", () => {
      // Mark agent-001 as busy so she is not considered (since she has 'general' specialty).
      service.updateAgentStatus("agent-001", "busy");

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
      expect(assigned.assignedAgentIds).toContain("agent-002");
    });

    it("should bypass offline or busy agents", () => {
      // Let's make everyone offline except Alice (agent-001)
      service.updateAgentStatus("agent-002", "offline");
      service.updateAgentStatus("agent-003", "offline");
      service.updateAgentStatus("agent-004", "busy");
      service.updateAgentStatus("agent-005", "offline");

      const newThread = service.simulateIncomingThread(
        "Security alert",
        "XSS attack check",
        "sec@test.org",
        "high",
      );

      // The best match specialty-wise is Bob (agent-002, security), but he is offline.
      // Alice (agent-001) is the only active agent left.
      const assigned = service.autoAssign(newThread.id);
      expect(assigned.assignedAgentIds).toContain("agent-001");
    });

    it("should throw if no active agents are online", () => {
      // Put everyone offline
      service.updateAgentStatus("agent-001", "offline");
      service.updateAgentStatus("agent-002", "offline");
      service.updateAgentStatus("agent-003", "offline");
      service.updateAgentStatus("agent-004", "offline");
      service.updateAgentStatus("agent-005", "offline");

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
