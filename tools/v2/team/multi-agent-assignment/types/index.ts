export interface Agent {
  id: string;
  name: string;
  role: string;
  email: string;
  status: "active" | "busy" | "offline";
  workload: number; // Current number of assigned threads
  specialties: string[]; // e.g., ["stellar", "security", "billing", "support", "technical"]
  avatar: string; // Emoji avatar
}

export interface Thread {
  id: string;
  subject: string;
  snippet: string;
  sender: string;
  priority: "low" | "medium" | "high";
  assignedAgentIds: string[];
  status: "unassigned" | "assigned" | "resolved";
  category?: string;
  date: string;
}

export interface AssignmentLog {
  id: string;
  threadId: string;
  threadSubject: string;
  agentId: string;
  agentName: string;
  action: "assigned" | "unassigned" | "auto-routed";
  timestamp: string;
  operator: string;
}

export interface AssignmentMetrics {
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
