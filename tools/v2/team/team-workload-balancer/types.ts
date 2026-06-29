export type Priority = "low" | "medium" | "high" | "urgent";

export type ItemStatus = "pending" | "in-progress" | "completed" | "blocked";

export type BalancingStrategy = "round-robin" | "least-loaded" | "capacity-weighted";

export interface TeamMember {
  id: string;
  name: string;
  capacity: number;
  currentLoad: number;
  roles: string[];
  skills: string[];
}

export interface WorkloadItem {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  status: ItemStatus;
  estimatedEffort: number;
  assignedTo: string | null;
  createdAt: string;
  dueAt: string | null;
  tags: string[];
}

export interface MemberWorkload {
  memberId: string;
  memberName: string;
  assignedItems: number;
  totalEstimatedEffort: number;
  utilization: number;
  pendingCount: number;
  inProgressCount: number;
  overdueCount: number;
}

export interface WorkloadMetrics {
  members: MemberWorkload[];
  totalItems: number;
  totalCapacity: number;
  totalAssigned: number;
  averageUtilization: number;
  maxUtilization: number;
  minUtilization: number;
  imbalanceScore: number;
}

export interface BalancerConfig {
  strategy: BalancingStrategy;
  prioritizeBy: Priority | null;
  considerSkills: boolean;
}

export interface AssignmentSuggestion {
  itemId: string;
  itemTitle: string;
  suggestedMemberId: string;
  suggestedMemberName: string;
  reason: string;
}

export interface BalanceResult {
  assignments: AssignmentSuggestion[];
  metrics: WorkloadMetrics;
}

export interface DateRange {
  start: string;
  end: string;
}

export type FetchState<T> =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error"; message: string }
  | { status: "success"; data: T };
