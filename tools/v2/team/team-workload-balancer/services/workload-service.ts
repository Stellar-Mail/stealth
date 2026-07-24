import type {
  AssignmentSuggestion,
  BalanceResult,
  BalancerConfig,
  MemberWorkload,
  Priority,
  TeamMember,
  WorkloadItem,
  WorkloadMetrics,
} from "../types";

import sampleMembers from "../fixtures/team-members.json";
import sampleItems from "../fixtures/workload-items.json";

const PRIORITY_ORDER: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function nowISO(): string {
  return new Date().toISOString();
}

function isOverdue(item: WorkloadItem): boolean {
  if (!item.dueAt) return false;
  return new Date(item.dueAt).getTime() < Date.now();
}

function getUtilization(member: TeamMember, items: WorkloadItem[]): number {
  const assigned = items.filter(
    (i) => i.assignedTo === member.id && i.status !== "completed",
  ).length;
  return member.capacity > 0 ? assigned / member.capacity : 1;
}

function calculateMemberWorkload(member: TeamMember, items: WorkloadItem[]): MemberWorkload {
  const assigned = items.filter((i) => i.assignedTo === member.id && i.status !== "completed");
  const pendingCount = assigned.filter((i) => i.status === "pending").length;
  const inProgressCount = assigned.filter((i) => i.status === "in-progress").length;
  const overdueCount = assigned.filter(isOverdue).length;
  const totalEstimatedEffort = assigned.reduce((s, i) => s + i.estimatedEffort, 0);
  const utilization =
    member.capacity > 0 ? Math.round((assigned.length / member.capacity) * 100 * 10) / 10 : 100;

  return {
    memberId: member.id,
    memberName: member.name,
    assignedItems: assigned.length,
    totalEstimatedEffort,
    utilization,
    pendingCount,
    inProgressCount,
    overdueCount,
  };
}

function calculateImbalanceScore(members: MemberWorkload[]): number {
  if (members.length === 0) return 0;
  const avg = members.reduce((s, m) => s + m.utilization, 0) / members.length;
  const variance = members.reduce((s, m) => s + (m.utilization - avg) ** 2, 0) / members.length;
  return Math.round(Math.sqrt(variance) * 10) / 10;
}

export function calculateWorkloadMetrics(
  members: TeamMember[],
  items: WorkloadItem[],
): WorkloadMetrics {
  const memberWorkloads = members.map((m) => calculateMemberWorkload(m, items));
  const totalCapacity = members.reduce((s, m) => s + m.capacity, 0);
  const totalAssigned = memberWorkloads.reduce((s, m) => s + m.assignedItems, 0);
  const totalItems = items.filter((i) => i.status !== "completed").length;
  const averageUtilization =
    members.length > 0
      ? Math.round((memberWorkloads.reduce((s, m) => s + m.utilization, 0) / members.length) * 10) /
        10
      : 0;
  const utilizationValues = memberWorkloads.map((m) => m.utilization);
  const maxUtilization = utilizationValues.length > 0 ? Math.max(...utilizationValues) : 0;
  const minUtilization = utilizationValues.length > 0 ? Math.min(...utilizationValues) : 0;

  return {
    members: memberWorkloads,
    totalItems,
    totalCapacity,
    totalAssigned,
    averageUtilization,
    maxUtilization,
    minUtilization,
    imbalanceScore: calculateImbalanceScore(memberWorkloads),
  };
}

function pickRoundRobin(
  unassigned: WorkloadItem[],
  members: TeamMember[],
  allItems: WorkloadItem[],
  index: number,
): AssignmentSuggestion {
  const item = unassigned[index];
  const sorted = [...members].sort(
    (a, b) => getUtilization(a, allItems) - getUtilization(b, allItems),
  );
  const target = sorted[0];
  return {
    itemId: item.id,
    itemTitle: item.title,
    suggestedMemberId: target.id,
    suggestedMemberName: target.name,
    reason: `Round-robin: ${target.name} has the lowest current utilization`,
  };
}

function pickLeastLoaded(
  item: WorkloadItem,
  members: TeamMember[],
  allItems: WorkloadItem[],
): AssignmentSuggestion {
  const sorted = [...members].sort(
    (a, b) => getUtilization(a, allItems) - getUtilization(b, allItems),
  );
  const target = sorted[0];
  return {
    itemId: item.id,
    itemTitle: item.title,
    suggestedMemberId: target.id,
    suggestedMemberName: target.name,
    reason: `Least-loaded: ${target.name} has the most available capacity`,
  };
}

function pickCapacityWeighted(
  item: WorkloadItem,
  members: TeamMember[],
  allItems: WorkloadItem[],
): AssignmentSuggestion {
  const weights = members.map((m) => {
    const util = getUtilization(m, allItems);
    const available = 1 - util;
    return { member: m, weight: Math.max(available, 0) };
  });
  const totalWeight = weights.reduce((s, w) => s + w.weight, 0);
  if (totalWeight <= 0) {
    const sorted = [...members].sort(
      (a, b) => getUtilization(a, allItems) - getUtilization(b, allItems),
    );
    const target = sorted[0];
    return {
      itemId: item.id,
      itemTitle: item.title,
      suggestedMemberId: target.id,
      suggestedMemberName: target.name,
      reason: `Capacity-weighted: all members at capacity; assigning to ${target.name} (least loaded)`,
    };
  }
  let roll = Math.random() * totalWeight;
  let target = weights[0].member;
  for (const w of weights) {
    roll -= w.weight;
    if (roll <= 0) {
      target = w.member;
      break;
    }
  }
  return {
    itemId: item.id,
    itemTitle: item.title,
    suggestedMemberId: target.id,
    suggestedMemberName: target.name,
    reason: `Capacity-weighted: ${target.name} selected proportionally by available capacity`,
  };
}

function sortByPriority(items: WorkloadItem[], prioritizeBy: Priority | null): WorkloadItem[] {
  if (!prioritizeBy) return items;
  return [...items].sort((a, b) => {
    const aPriority = PRIORITY_ORDER[a.priority];
    const bPriority = PRIORITY_ORDER[b.priority];
    if (aPriority === bPriority) return 0;
    return aPriority < bPriority ? -1 : 1;
  });
}

export function suggestAssignment(
  item: WorkloadItem,
  members: TeamMember[],
  allItems: WorkloadItem[],
  config: BalancerConfig,
  roundRobinIndex: number = 0,
): AssignmentSuggestion {
  switch (config.strategy) {
    case "round-robin": {
      const unassigned = [item];
      return pickRoundRobin(unassigned, members, allItems, 0);
    }
    case "least-loaded":
      return pickLeastLoaded(item, members, allItems);
    case "capacity-weighted":
      return pickCapacityWeighted(item, members, allItems);
    default:
      return pickLeastLoaded(item, members, allItems);
  }
}

export function balanceWorkload(
  unassignedItems: WorkloadItem[],
  members: TeamMember[],
  allItems: WorkloadItem[],
  config: BalancerConfig,
): BalanceResult {
  const sorted = sortByPriority(unassignedItems, config.prioritizeBy);
  const { considerSkills } = config;

  let candidates = [...members];
  if (considerSkills) {
    const allSkills = new Set<string>();
    for (const item of sorted) {
      for (const tag of item.tags) allSkills.add(tag);
    }
    candidates = members.filter((m) => m.skills.some((s) => allSkills.has(s)));
    if (candidates.length === 0) candidates = [...members];
  }

  const assignments: AssignmentSuggestion[] = [];
  const workingItems = [...allItems];

  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i];
    const suggestion =
      config.strategy === "round-robin"
        ? pickRoundRobin(sorted, candidates, workingItems, i)
        : config.strategy === "capacity-weighted"
          ? pickCapacityWeighted(item, candidates, workingItems)
          : pickLeastLoaded(item, candidates, workingItems);

    workingItems.push({ ...item, assignedTo: suggestion.suggestedMemberId });
    assignments.push(suggestion);
  }

  const metrics = calculateWorkloadMetrics(members, workingItems);

  return { assignments, metrics };
}

export interface WorkloadServiceConfig {
  simulateDelay?: boolean;
  delayMs?: number;
  failureRate?: number;
}

export function createWorkloadService(config: WorkloadServiceConfig = {}) {
  const { simulateDelay = true, delayMs = 600, failureRate = 0 } = config;

  const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  async function getTeamMembers(): Promise<TeamMember[]> {
    if (simulateDelay) await delay(delayMs / 2);
    if (Math.random() < failureRate) {
      throw new Error("Failed to load team members.");
    }
    return sampleMembers as TeamMember[];
  }

  async function getWorkloadItems(): Promise<WorkloadItem[]> {
    if (simulateDelay) await delay(delayMs);
    if (Math.random() < failureRate) {
      throw new Error("Failed to load workload items.");
    }
    return sampleItems as WorkloadItem[];
  }

  async function getWorkloadMetrics(): Promise<WorkloadMetrics> {
    const [members, items] = await Promise.all([getTeamMembers(), getWorkloadItems()]);
    return calculateWorkloadMetrics(members, items);
  }

  async function getBalanceSuggestions(config: BalancerConfig): Promise<BalanceResult> {
    const [members, allItems] = await Promise.all([getTeamMembers(), getWorkloadItems()]);
    const unassigned = allItems.filter((i) => i.assignedTo === null && i.status !== "completed");
    return balanceWorkload(unassigned, members, allItems, config);
  }

  return {
    getTeamMembers,
    getWorkloadItems,
    getWorkloadMetrics,
    getBalanceSuggestions,
    calculateWorkloadMetrics,
    balanceWorkload,
    suggestAssignment,
  };
}

export type WorkloadService = ReturnType<typeof createWorkloadService>;
