/**
 * contract.test.ts — Multi-Agent Assignment (execution contract)
 *
 * Verifies the non-UI execution contract: typed inputs/outputs, all operations,
 * error handling, and edge cases. No UI is exercised.
 */

import { describe, it, expect } from "vitest";
import { createAssignmentContract } from "../contract";
import {
  AssignmentErrorCode,
  ok,
  fail,
  type AssignmentResult,
  type AssignmentContractOutput,
} from "../contract";
import { AGENT_FIXTURES, THREAD_FIXTURES } from "../fixtures/multi-agent.fixtures";

function makeContract() {
  return createAssignmentContract(AGENT_FIXTURES, THREAD_FIXTURES);
}

describe("assignment contract — result helpers", () => {
  it("ok() produces a typed success result", () => {
    const r = ok("v");
    expect(r).toEqual({ ok: true, value: "v" });
  });

  it("fail() produces a typed error result with code + message", () => {
    const r = fail(AssignmentErrorCode.ThreadNotFound, "missing");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe(AssignmentErrorCode.ThreadNotFound);
      expect(r.message).toBe("missing");
    }
  });
});

describe("assignment contract — getAgents", () => {
  it("returns all agents", () => {
    const contract = makeContract();
    const res = contract.execute({ operation: "getAgents" });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "getAgents") {
      expect(res.value.agents).toHaveLength(AGENT_FIXTURES.length);
      expect(res.value.agents[0].id).toBe(AGENT_FIXTURES[0].id);
    }
  });
});

describe("assignment contract — getThreads", () => {
  it("returns all threads", () => {
    const contract = makeContract();
    const res = contract.execute({ operation: "getThreads" });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "getThreads") {
      expect(res.value.threads).toHaveLength(THREAD_FIXTURES.length);
      expect(res.value.threads[0].id).toBe(THREAD_FIXTURES[0].id);
    }
  });
});

describe("assignment contract — getLogs", () => {
  it("returns empty logs initially", () => {
    const contract = makeContract();
    const res = contract.execute({ operation: "getLogs" });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "getLogs") {
      expect(res.value.logs).toEqual([]);
    }
  });
});

describe("assignment contract — assignAgent", () => {
  it("assigns an agent to a thread successfully", () => {
    const contract = makeContract();
    const res = contract.execute({
      operation: "assignAgent",
      threadId: THREAD_FIXTURES[0].id,
      agentId: AGENT_FIXTURES[0].id,
    });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "assignAgent") {
      expect(res.value.thread.assignedAgentIds).toContain(AGENT_FIXTURES[0].id);
      expect(res.value.thread.status).toBe("assigned");
    }
  });

  it("rejects assignment to non-existent thread (no throw)", () => {
    const contract = makeContract();
    const res: AssignmentResult<AssignmentContractOutput> = contract.execute({
      operation: "assignAgent",
      threadId: "non-existent-thread",
      agentId: AGENT_FIXTURES[0].id,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(AssignmentErrorCode.ThreadNotFound);
  });

  it("rejects assignment with non-existent agent (no throw)", () => {
    const contract = makeContract();
    const res: AssignmentResult<AssignmentContractOutput> = contract.execute({
      operation: "assignAgent",
      threadId: THREAD_FIXTURES[0].id,
      agentId: "non-existent-agent",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(AssignmentErrorCode.AgentNotFound);
  });

  it("rejects assignment to resolved thread (no throw)", () => {
    const contract = makeContract();
    // First resolve a thread
    contract.execute({
      operation: "resolveThread",
      threadId: THREAD_FIXTURES[0].id,
    });
    // Then try to assign
    const res: AssignmentResult<AssignmentContractOutput> = contract.execute({
      operation: "assignAgent",
      threadId: THREAD_FIXTURES[0].id,
      agentId: AGENT_FIXTURES[0].id,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(AssignmentErrorCode.InvalidOperation);
  });

  it("is idempotent - re-assigning same agent returns success without duplicate logs", () => {
    const contract = makeContract();
    const threadId = THREAD_FIXTURES[0].id;
    const agentId = AGENT_FIXTURES[0].id;
    
    contract.execute({ operation: "assignAgent", threadId, agentId });
    const logsBefore = contract.execute({ operation: "getLogs" });
    
    contract.execute({ operation: "assignAgent", threadId, agentId });
    const logsAfter = contract.execute({ operation: "getLogs" });
    
    if (logsBefore.ok && logsBefore.value.operation === "getLogs" &&
        logsAfter.ok && logsAfter.value.operation === "getLogs") {
      expect(logsAfter.value.logs.length).toBe(logsBefore.value.logs.length);
    }
  });
});

describe("assignment contract — unassignAgent", () => {
  it("unassigns an agent from a thread successfully", () => {
    const contract = makeContract();
    const threadId = THREAD_FIXTURES[0].id;
    const agentId = AGENT_FIXTURES[0].id;
    
    // First assign
    contract.execute({ operation: "assignAgent", threadId, agentId });
    
    // Then unassign
    const res = contract.execute({
      operation: "unassignAgent",
      threadId,
      agentId,
    });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "unassignAgent") {
      expect(res.value.thread.assignedAgentIds).not.toContain(agentId);
    }
  });

  it("rejects unassignment from non-existent thread (no throw)", () => {
    const contract = makeContract();
    const res: AssignmentResult<AssignmentContractOutput> = contract.execute({
      operation: "unassignAgent",
      threadId: "non-existent-thread",
      agentId: AGENT_FIXTURES[0].id,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(AssignmentErrorCode.ThreadNotFound);
  });

  it("rejects unassignment with non-existent agent (no throw)", () => {
    const contract = makeContract();
    const res: AssignmentResult<AssignmentContractOutput> = contract.execute({
      operation: "unassignAgent",
      threadId: THREAD_FIXTURES[0].id,
      agentId: "non-existent-agent",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(AssignmentErrorCode.AgentNotFound);
  });

  it("is idempotent - unassigning already unassigned agent returns success", () => {
    const contract = makeContract();
    const res = contract.execute({
      operation: "unassignAgent",
      threadId: THREAD_FIXTURES[0].id,
      agentId: AGENT_FIXTURES[0].id,
    });
    expect(res.ok).toBe(true);
  });
});

describe("assignment contract — updateAgentStatus", () => {
  it("updates agent status successfully", () => {
    const contract = makeContract();
    const res = contract.execute({
      operation: "updateAgentStatus",
      agentId: AGENT_FIXTURES[0].id,
      status: "busy",
    });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "updateAgentStatus") {
      expect(res.value.agent.status).toBe("busy");
    }
  });

  it("rejects status update for non-existent agent (no throw)", () => {
    const contract = makeContract();
    const res: AssignmentResult<AssignmentContractOutput> = contract.execute({
      operation: "updateAgentStatus",
      agentId: "non-existent-agent",
      status: "busy",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(AssignmentErrorCode.AgentNotFound);
  });
});

describe("assignment contract — resolveThread", () => {
  it("resolves a thread successfully", () => {
    const contract = makeContract();
    const threadId = THREAD_FIXTURES[0].id;
    const agentId = AGENT_FIXTURES[0].id;
    
    // First assign
    contract.execute({ operation: "assignAgent", threadId, agentId });
    
    // Then resolve
    const res = contract.execute({
      operation: "resolveThread",
      threadId,
    });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "resolveThread") {
      expect(res.value.thread.status).toBe("resolved");
      expect(res.value.thread.assignedAgentIds).toEqual([]);
    }
  });

  it("rejects resolution of non-existent thread (no throw)", () => {
    const contract = makeContract();
    const res: AssignmentResult<AssignmentContractOutput> = contract.execute({
      operation: "resolveThread",
      threadId: "non-existent-thread",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(AssignmentErrorCode.ThreadNotFound);
  });

  it("is idempotent - resolving already resolved thread returns success", () => {
    const contract = makeContract();
    const threadId = THREAD_FIXTURES[0].id;
    
    contract.execute({ operation: "resolveThread", threadId });
    const res = contract.execute({ operation: "resolveThread", threadId });
    
    expect(res.ok).toBe(true);
  });
});

describe("assignment contract — autoAssign", () => {
  it("auto-assigns thread to best matching agent", () => {
    const contract = makeContract();
    const res = contract.execute({
      operation: "autoAssign",
      threadId: THREAD_FIXTURES[0].id,
    });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "autoAssign") {
      expect(res.value.thread.status).toBe("assigned");
      expect(res.value.thread.assignedAgentIds.length).toBeGreaterThan(0);
    }
  });

  it("rejects auto-assignment for non-existent thread (no throw)", () => {
    const contract = makeContract();
    const res: AssignmentResult<AssignmentContractOutput> = contract.execute({
      operation: "autoAssign",
      threadId: "non-existent-thread",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(AssignmentErrorCode.ThreadNotFound);
  });

  it("rejects auto-assignment when no active agents (no throw)", () => {
    const contract = createAssignmentContract(
      AGENT_FIXTURES.map((a) => ({ ...a, status: "offline" as const })),
      THREAD_FIXTURES,
    );
    const res: AssignmentResult<AssignmentContractOutput> = contract.execute({
      operation: "autoAssign",
      threadId: THREAD_FIXTURES[0].id,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(AssignmentErrorCode.NoActiveAgents);
  });
});

describe("assignment contract — simulateIncomingThread", () => {
  it("simulates incoming thread successfully", () => {
    const contract = makeContract();
    const res = contract.execute({
      operation: "simulateIncomingThread",
      subject: "Test Subject",
      snippet: "Test snippet",
      sender: "test@example.com",
      priority: "high",
    });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "simulateIncomingThread") {
      expect(res.value.thread.subject).toBe("Test Subject");
      expect(res.value.thread.status).toBe("unassigned");
      expect(res.value.thread.assignedAgentIds).toEqual([]);
    }
  });
});

describe("assignment contract — getMetrics", () => {
  it("returns workspace metrics", () => {
    const contract = makeContract();
    const res = contract.execute({ operation: "getMetrics" });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "getMetrics") {
      expect(res.value.metrics.totalThreads).toBe(THREAD_FIXTURES.length);
      expect(res.value.metrics.totalAgents).toBe(AGENT_FIXTURES.length);
      expect(typeof res.value.metrics.averageWorkload).toBe("number");
    }
  });
});

describe("assignment contract — audit trail", () => {
  it("logs assignment actions", () => {
    const contract = makeContract();
    contract.execute({
      operation: "assignAgent",
      threadId: THREAD_FIXTURES[0].id,
      agentId: AGENT_FIXTURES[0].id,
      operator: "TestOperator",
    });
    
    const logsRes = contract.execute({ operation: "getLogs" });
    expect(logsRes.ok).toBe(true);
    if (logsRes.ok && logsRes.value.operation === "getLogs") {
      expect(logsRes.value.logs.length).toBeGreaterThan(0);
      expect(logsRes.value.logs[0].operator).toBe("TestOperator");
      expect(logsRes.value.logs[0].action).toBe("assigned");
    }
  });

  it("logs auto-assignment with special operator name", () => {
    const contract = makeContract();
    contract.execute({
      operation: "autoAssign",
      threadId: THREAD_FIXTURES[0].id,
    });
    
    const logsRes = contract.execute({ operation: "getLogs" });
    expect(logsRes.ok).toBe(true);
    if (logsRes.ok && logsRes.value.operation === "getLogs") {
      expect(logsRes.value.logs[0].operator).toBe("Auto-Routing Engine");
      expect(logsRes.value.logs[0].action).toBe("auto-routed");
    }
  });
});
