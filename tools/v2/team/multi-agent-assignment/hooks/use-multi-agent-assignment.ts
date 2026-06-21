import { useState, useMemo, useCallback } from "react";
import { createAssignmentService } from "../services/assignment.service";
import { Agent, Thread, AssignmentLog } from "../types";

export function useMultiAgentAssignment() {
  const [service] = useState(() => createAssignmentService());
  const [agents, setAgents] = useState<Agent[]>(() => service.getAgents());
  const [threads, setThreads] = useState<Thread[]>(() => service.getThreads());
  const [logs, setLogs] = useState<AssignmentLog[]>(() => service.getLogs());

  const syncState = useCallback(() => {
    // Return copies to force React re-render
    setAgents([...service.getAgents()]);
    setThreads([...service.getThreads()]);
    setLogs([...service.getLogs()]);
  }, [service]);

  const metrics = useMemo(() => {
    return service.getMetrics();
  }, [agents, threads, service]);

  const assignAgent = useCallback(
    (threadId: string, agentId: string, operator = "Admin") => {
      service.assignAgent(threadId, agentId, operator);
      syncState();
    },
    [service, syncState],
  );

  const unassignAgent = useCallback(
    (threadId: string, agentId: string, operator = "Admin") => {
      service.unassignAgent(threadId, agentId, operator);
      syncState();
    },
    [service, syncState],
  );

  const updateAgentStatus = useCallback(
    (agentId: string, status: "active" | "busy" | "offline") => {
      service.updateAgentStatus(agentId, status);
      syncState();
    },
    [service, syncState],
  );

  const resolveThread = useCallback(
    (threadId: string, operator = "Admin") => {
      service.resolveThread(threadId, operator);
      syncState();
    },
    [service, syncState],
  );

  const autoAssign = useCallback(
    (threadId: string) => {
      service.autoAssign(threadId);
      syncState();
    },
    [service, syncState],
  );

  const autoAssignAllUnassigned = useCallback(() => {
    const unassigned = threads.filter((t) => t.status === "unassigned");
    let count = 0;
    const errors: string[] = [];

    for (const t of unassigned) {
      try {
        service.autoAssign(t.id);
        count++;
      } catch (err: any) {
        errors.push(`${t.id}: ${err.message}`);
      }
    }
    syncState();
    return { count, errors };
  }, [threads, service, syncState]);

  const simulateIncomingThread = useCallback(
    (
      subject: string,
      snippet: string,
      sender: string,
      priority: "low" | "medium" | "high",
      category?: string,
    ) => {
      service.simulateIncomingThread(subject, snippet, sender, priority, category);
      syncState();
    },
    [service, syncState],
  );

  return {
    agents,
    threads,
    logs,
    metrics,
    assignAgent,
    unassignAgent,
    updateAgentStatus,
    resolveThread,
    autoAssign,
    autoAssignAllUnassigned,
    simulateIncomingThread,
  };
}
export default useMultiAgentAssignment;
