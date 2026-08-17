/**
 * contract.fixtures.ts — Team Workload Balancer (execution contract fixtures)
 *
 * Deterministic local fixtures used by the contract tests and as documentation
 * of the contract shape. Mirrors the JSON fixtures shipped with the tool.
 */

import type { TeamMember, WorkloadItem } from "./types";

/** A small deterministic team (no randomness in assignments). */
export const SAMPLE_MEMBERS: TeamMember[] = [
  {
    id: "mem-001",
    name: "Alex Chen",
    capacity: 10,
    currentLoad: 4,
    roles: ["developer"],
    skills: ["react", "node"],
  },
  {
    id: "mem-002",
    name: "Jordan Taylor",
    capacity: 8,
    currentLoad: 5,
    roles: ["developer"],
    skills: ["react", "python"],
  },
  {
    id: "mem-003",
    name: "Morgan Singh",
    capacity: 6,
    currentLoad: 2,
    roles: ["designer"],
    skills: ["css", "figma"],
  },
];

/** Two unassigned items to balance. */
export const SAMPLE_UNASSIGNED: WorkloadItem[] = [
  {
    id: "item-001",
    title: "Fix login bug",
    description: "",
    priority: "high",
    status: "pending",
    estimatedEffort: 3,
    assignedTo: null,
    createdAt: "2026-06-01T09:00:00.000Z",
    dueAt: null,
    tags: ["react"],
  },
  {
    id: "item-002",
    title: "Design settings page",
    description: "",
    priority: "medium",
    status: "pending",
    estimatedEffort: 2,
    assignedTo: null,
    createdAt: "2026-06-01T10:00:00.000Z",
    dueAt: null,
    tags: ["css"],
  },
];

/** The full item set (includes the unassigned ones). */
export const SAMPLE_ALL_ITEMS: WorkloadItem[] = [...SAMPLE_UNASSIGNED];
