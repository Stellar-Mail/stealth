import { Agent, Thread, AssignmentLog, AssignmentMetrics } from "../types";
import { AGENT_FIXTURES, THREAD_FIXTURES } from "../fixtures/multi-agent.fixtures";

export function getThreadRequiredSpecialties(thread: Thread): string[] {
  const specialties: string[] = [];
  const text = `${thread.subject} ${thread.snippet} ${thread.category ?? ""}`.toLowerCase();

  if (
    text.includes("stellar") ||
    text.includes("blockchain") ||
    text.includes("freighter") ||
    text.includes("escrow")
  ) {
    specialties.push("stellar");
  }
  if (
    text.includes("security") ||
    text.includes("login") ||
    text.includes("anomalous") ||
    text.includes("hack") ||
    text.includes("xss")
  ) {
    specialties.push("security");
  }
  if (
    text.includes("billing") ||
    text.includes("invoice") ||
    text.includes("discrepancy") ||
    text.includes("finance")
  ) {
    specialties.push("billing");
  }
  if (
    text.includes("api") ||
    text.includes("gateway") ||
    text.includes("technical") ||
    text.includes("error") ||
    text.includes("502")
  ) {
    specialties.push("technical");
  }
  if (
    text.includes("support") ||
    text.includes("help") ||
    text.includes("question") ||
    text.includes("feedback")
  ) {
    specialties.push("support");
  }

  if (specialties.length === 0) {
    specialties.push("general");
  }

  return specialties;
}

export function computeMetrics(agents: Agent[], threads: Thread[]): AssignmentMetrics {
  const totalThreads = threads.length;
  const unassignedThreads = threads.filter((t) => t.status === "unassigned").length;
  const assignedThreads = threads.filter((t) => t.status === "assigned").length;
  const resolvedThreads = threads.filter((t) => t.status === "resolved").length;

  const totalAgents = agents.length;
  const activeAgents = agents.filter((a) => a.status === "active").length;
  const busyAgents = agents.filter((a) => a.status === "busy").length;
  const offlineAgents = agents.filter((a) => a.status === "offline").length;

  const totalWorkload = agents.reduce((sum, a) => sum + a.workload, 0);
  const averageWorkload = totalAgents > 0 ? Number((totalWorkload / totalAgents).toFixed(1)) : 0;

  return {
    totalThreads,
    unassignedThreads,
    assignedThreads,
    resolvedThreads,
    totalAgents,
    activeAgents,
    busyAgents,
    offlineAgents,
    averageWorkload,
  };
}

export function createAssignmentService(
  initialAgents: Agent[] = AGENT_FIXTURES,
  initialThreads: Thread[] = THREAD_FIXTURES,
) {
  let agents = initialAgents.map((a) => ({ ...a }));
  let threads = initialThreads.map((t) => ({ ...t }));
  let logs: AssignmentLog[] = [];
  let logCounter = 0;

  function getAgents() {
    return agents;
  }

  function getThreads() {
    return threads;
  }

  function getLogs() {
    return logs;
  }

  function assignAgent(threadId: string, agentId: string, operator = "Admin"): Thread {
    const threadIdx = threads.findIndex((t) => t.id === threadId);
    if (threadIdx === -1) {
      throw new Error(`Thread ${threadId} not found.`);
    }

    const agentIdx = agents.findIndex((a) => a.id === agentId);
    if (agentIdx === -1) {
      throw new Error(`Agent ${agentId} not found.`);
    }

    const thread = threads[threadIdx];
    const agent = agents[agentIdx];

    if (thread.status === "resolved") {
      throw new Error(`Thread ${threadId} is already resolved. Cannot assign agents.`);
    }

    if (thread.assignedAgentIds.includes(agentId)) {
      return thread; // Already assigned, idempotent
    }

    // Update thread
    const updatedThread: Thread = {
      ...thread,
      assignedAgentIds: [...thread.assignedAgentIds, agentId],
      status: "assigned",
    };
    threads = threads.map((t) => (t.id === threadId ? updatedThread : t));

    // Update agent workload
    const updatedAgent: Agent = {
      ...agent,
      workload: agent.workload + 1,
    };
    agents = agents.map((a) => (a.id === agentId ? updatedAgent : a));

    // Add log
    logCounter++;
    const log: AssignmentLog = {
      id: `log-${String(logCounter).padStart(3, "0")}`,
      threadId,
      threadSubject: thread.subject,
      agentId,
      agentName: agent.name,
      action: operator === "Auto-Routing Engine" ? "auto-routed" : "assigned",
      timestamp: new Date().toISOString(),
      operator,
    };
    logs = [log, ...logs];

    return updatedThread;
  }

  function unassignAgent(threadId: string, agentId: string, operator = "Admin"): Thread {
    const threadIdx = threads.findIndex((t) => t.id === threadId);
    if (threadIdx === -1) {
      throw new Error(`Thread ${threadId} not found.`);
    }

    const agentIdx = agents.findIndex((a) => a.id === agentId);
    if (agentIdx === -1) {
      throw new Error(`Agent ${agentId} not found.`);
    }

    const thread = threads[threadIdx];
    const agent = agents[agentIdx];

    if (!thread.assignedAgentIds.includes(agentId)) {
      return thread; // Not assigned, idempotent
    }

    // Update thread
    const newAssignedAgentIds = thread.assignedAgentIds.filter((id) => id !== agentId);
    const updatedThread: Thread = {
      ...thread,
      assignedAgentIds: newAssignedAgentIds,
      status: newAssignedAgentIds.length === 0 ? "unassigned" : "assigned",
    };
    threads = threads.map((t) => (t.id === threadId ? updatedThread : t));

    // Update agent workload
    const updatedAgent: Agent = {
      ...agent,
      workload: Math.max(0, agent.workload - 1),
    };
    agents = agents.map((a) => (a.id === agentId ? updatedAgent : a));

    // Add log
    logCounter++;
    const log: AssignmentLog = {
      id: `log-${String(logCounter).padStart(3, "0")}`,
      threadId,
      threadSubject: thread.subject,
      agentId,
      agentName: agent.name,
      action: "unassigned",
      timestamp: new Date().toISOString(),
      operator,
    };
    logs = [log, ...logs];

    return updatedThread;
  }

  function updateAgentStatus(agentId: string, status: "active" | "busy" | "offline"): Agent {
    const agentIdx = agents.findIndex((a) => a.id === agentId);
    if (agentIdx === -1) {
      throw new Error(`Agent ${agentId} not found.`);
    }

    const agent = agents[agentIdx];
    const updatedAgent: Agent = { ...agent, status };

    // If changing to offline, we might want to unassign them from active tickets, but for demo let's just keep assignments
    agents = agents.map((a) => (a.id === agentId ? updatedAgent : a));
    return updatedAgent;
  }

  function resolveThread(threadId: string, operator = "Admin"): Thread {
    const threadIdx = threads.findIndex((t) => t.id === threadId);
    if (threadIdx === -1) {
      throw new Error(`Thread ${threadId} not found.`);
    }

    const thread = threads[threadIdx];
    if (thread.status === "resolved") {
      return thread; // Already resolved
    }

    // Reduce workloads of currently assigned agents
    const assignedIds = thread.assignedAgentIds;
    agents = agents.map((a) => {
      if (assignedIds.includes(a.id)) {
        return { ...a, workload: Math.max(0, a.workload - 1) };
      }
      return a;
    });

    // Clear assignments and set status
    const updatedThread: Thread = {
      ...thread,
      assignedAgentIds: [],
      status: "resolved",
    };
    threads = threads.map((t) => (t.id === threadId ? updatedThread : t));

    // Log the resolution
    logCounter++;
    logs = [
      {
        id: `log-${String(logCounter).padStart(3, "0")}`,
        threadId,
        threadSubject: thread.subject,
        agentId: "all",
        agentName: "N/A",
        action: "unassigned",
        timestamp: new Date().toISOString(),
        operator: `${operator} (Resolved Thread)`,
      },
      ...logs,
    ];

    return updatedThread;
  }

  function autoAssign(threadId: string): Thread {
    const thread = threads.find((t) => t.id === threadId);
    if (!thread) {
      throw new Error(`Thread ${threadId} not found.`);
    }

    if (thread.status === "resolved") {
      throw new Error(`Thread ${threadId} is resolved. Cannot auto-assign.`);
    }

    // Only active agents can be assigned
    const activeAgents = agents.filter((a) => a.status === "active");
    if (activeAgents.length === 0) {
      throw new Error("No active agents available for assignment.");
    }

    const reqSpecs = getThreadRequiredSpecialties(thread);

    // Calculate score for each active agent
    const candidates = activeAgents.map((agent) => {
      // Find matching specialties
      const matchCount = agent.specialties.filter((spec) => reqSpecs.includes(spec)).length;
      return {
        agent,
        matchCount,
        workload: agent.workload,
      };
    });

    // Sort:
    // 1. Higher number of matching specialties
    // 2. Lower workload
    candidates.sort((a, b) => {
      if (b.matchCount !== a.matchCount) {
        return b.matchCount - a.matchCount; // Descending matches
      }
      return a.workload - b.workload; // Ascending workload
    });

    const bestCandidate = candidates[0].agent;
    return assignAgent(threadId, bestCandidate.id, "Auto-Routing Engine");
  }

  function simulateIncomingThread(
    subject: string,
    snippet: string,
    sender: string,
    priority: "low" | "medium" | "high",
    category?: string,
  ): Thread {
    const newId = `thread-${String(threads.length + 1).padStart(3, "0")}`;
    const newThread: Thread = {
      id: newId,
      subject,
      snippet,
      sender,
      priority,
      assignedAgentIds: [],
      status: "unassigned",
      category: category ?? "General",
      date: new Date().toISOString(),
    };

    threads = [...threads, newThread];
    return newThread;
  }

  function getMetrics(): AssignmentMetrics {
    return computeMetrics(agents, threads);
  }

  return {
    getAgents,
    getThreads,
    getLogs,
    assignAgent,
    unassignAgent,
    updateAgentStatus,
    resolveThread,
    autoAssign,
    simulateIncomingThread,
    getMetrics,
  };
}
