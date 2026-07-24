/**
 * security.ts — hardening helpers for the Team Workload Balancer tool (#712).
 *
 * Adds explicit handling for malformed / hostile input and guards against
 * unnecessary work on large teams / histories, per the issue acceptance
 * criteria. This module is ADDITIVE: the existing `services/workload-service.ts`
 * is not modified; callers opt into the hardened path via `validateBalanceInput`
 * / `sanitizeWorkloadItem` / `sanitizeTeamMember` / `enforceWorkloadBounds`.
 *
 * Unsafe inputs addressed:
 *  - Oversized / control-byte-laden item titles, descriptions, member names
 *  - Out-of-range enums (priority, status), bad strategy in config
 *  - Negative or non-finite capacity / effort / load
 *  - Malformed or non-date `dueAt` (Date.parse abuse)
 *  - Oversized tags / roles / skills arrays
 *  - Unbounded item/member counts that amplify the O(n·m) balancing loop
 */

import type { BalancerConfig, Priority, TeamMember, WorkloadItem } from "./types";

/** Hard limits derived from threat assumptions (see docs/SECURITY.md). */
export const MAX_TITLE_CHARS = 500;
export const MAX_DESC_CHARS = 2_000;
export const MAX_NAME_CHARS = 200;
export const MAX_TAGS = 20;
export const MAX_ROLES = 20;
export const MAX_SKILLS = 50;
export const MAX_ITEMS = 5_000;
export const MAX_MEMBERS = 500;
export const MAX_EFFORT = 1e9;

const PRIORITIES: Priority[] = ["low", "medium", "high", "urgent"];
const STRATEGIES = ["round-robin", "least-loaded", "capacity-weighted"];

/** Strip control characters (keep TAB/LF/CR) and collapse whitespace. */
function stripControlChars(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    const isControl = code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d;
    if (isControl) continue;
    out += ch;
  }
  return out.replace(/\s+/g, " ").trim();
}

function clamp(input: string, max: number): string {
  return input.length > max ? input.slice(0, max) : input;
}

/** True only for a parseable ISO-ish date string. */
export function isValidISODate(value: string | null): boolean {
  if (value === null) return true;
  if (typeof value !== "string" || value.length === 0) return false;
  const t = Date.parse(value);
  return Number.isFinite(t);
}

export type SecurityIssue = { field: string; message: string };

/** Validate + sanitize a single workload item. Returns sanitized copy + issues. */
export function sanitizeWorkloadItem(item: WorkloadItem): {
  value: WorkloadItem;
  issues: SecurityIssue[];
} {
  const issues: SecurityIssue[] = [];
  if (!item || typeof item !== "object") {
    return { value: item, issues: [{ field: "item", message: "item is required" }] };
  }

  if (typeof item.id !== "string" || item.id.trim().length === 0) {
    issues.push({ field: "id", message: "id is required" });
  }
  const title = clamp(stripControlChars(item.title ?? ""), MAX_TITLE_CHARS);
  const description = clamp(stripControlChars(item.description ?? ""), MAX_DESC_CHARS);

  if (typeof item.priority !== "string" || !PRIORITIES.includes(item.priority)) {
    issues.push({ field: "priority", message: "priority must be low|medium|high|urgent" });
  }
  if (
    typeof item.estimatedEffort !== "number" ||
    !Number.isFinite(item.estimatedEffort) ||
    item.estimatedEffort < 0 ||
    item.estimatedEffort > MAX_EFFORT
  ) {
    issues.push({ field: "estimatedEffort", message: "estimatedEffort must be finite and >= 0" });
  }
  if (!isValidISODate(item.dueAt)) {
    issues.push({ field: "dueAt", message: "dueAt must be a valid date or null" });
  }
  if (!Array.isArray(item.tags) || item.tags.length > MAX_TAGS) {
    issues.push({ field: "tags", message: `tags must be an array with <= ${MAX_TAGS} entries` });
  }

  return {
    value: {
      ...item,
      id: clamp(stripControlChars(item.id ?? ""), MAX_NAME_CHARS),
      title,
      description,
      tags: Array.isArray(item.tags) ? item.tags.slice(0, MAX_TAGS) : [],
    },
    issues,
  };
}

/** Validate + sanitize a team member. Returns sanitized copy + issues. */
export function sanitizeTeamMember(member: TeamMember): {
  value: TeamMember;
  issues: SecurityIssue[];
} {
  const issues: SecurityIssue[] = [];
  if (!member || typeof member !== "object") {
    return { value: member, issues: [{ field: "member", message: "member is required" }] };
  }

  if (typeof member.id !== "string" || member.id.trim().length === 0) {
    issues.push({ field: "id", message: "id is required" });
  }
  const name = clamp(stripControlChars(member.name ?? ""), MAX_NAME_CHARS);
  if (name.length === 0) issues.push({ field: "name", message: "name is required" });

  if (
    typeof member.capacity !== "number" ||
    !Number.isFinite(member.capacity) ||
    member.capacity < 0
  ) {
    issues.push({ field: "capacity", message: "capacity must be finite and >= 0" });
  }
  if (
    typeof member.currentLoad !== "number" ||
    !Number.isFinite(member.currentLoad) ||
    member.currentLoad < 0
  ) {
    issues.push({ field: "currentLoad", message: "currentLoad must be finite and >= 0" });
  }
  if (!Array.isArray(member.roles) || member.roles.length > MAX_ROLES) {
    issues.push({ field: "roles", message: `roles must be an array with <= ${MAX_ROLES} entries` });
  }
  if (!Array.isArray(member.skills) || member.skills.length > MAX_SKILLS) {
    issues.push({
      field: "skills",
      message: `skills must be an array with <= ${MAX_SKILLS} entries`,
    });
  }

  return {
    value: {
      ...member,
      id: clamp(stripControlChars(member.id ?? ""), MAX_NAME_CHARS),
      name,
      roles: Array.isArray(member.roles) ? member.roles.slice(0, MAX_ROLES) : [],
      skills: Array.isArray(member.skills) ? member.skills.slice(0, MAX_SKILLS) : [],
    },
    issues,
  };
}

/**
 * Validate the whole balance input (items + members + config). Callers must
 * refuse to balance when `issues.length > 0`.
 */
export function validateBalanceInput(
  unassignedItems: WorkloadItem[],
  members: TeamMember[],
  config: BalancerConfig,
): SecurityIssue[] {
  const issues: SecurityIssue[] = [];

  if (!Array.isArray(unassignedItems))
    issues.push({ field: "items", message: "items must be an array" });
  if (!Array.isArray(members) || members.length === 0) {
    issues.push({ field: "members", message: "members must be a non-empty array" });
  }
  if (!config || typeof config !== "object") {
    issues.push({ field: "config", message: "config is required" });
  } else if (!STRATEGIES.includes(config.strategy)) {
    issues.push({ field: "strategy", message: "strategy must be a known balancing strategy" });
  }

  if (unassignedItems.length > MAX_ITEMS) {
    issues.push({ field: "items", message: `too many items (max ${MAX_ITEMS})` });
  }
  if (members.length > MAX_MEMBERS) {
    issues.push({ field: "members", message: `too many members (max ${MAX_MEMBERS})` });
  }

  for (const item of unassignedItems) {
    const { issues: itemIssues } = sanitizeWorkloadItem(item);
    for (const i of itemIssues)
      issues.push({ field: `items.${item?.id ?? "?"}:${i.field}`, message: i.message });
  }
  for (const m of members) {
    const { issues: mIssues } = sanitizeTeamMember(m);
    for (const i of mIssues)
      issues.push({ field: `members.${m?.id ?? "?"}:${i.field}`, message: i.message });
  }

  return issues;
}

/**
 * Performance guard: bound item/member counts so the O(n·m) balancing loop
 * cannot be amplified by an enormous dataset. Returns capped slices.
 */
export function enforceWorkloadBounds(
  unassignedItems: WorkloadItem[],
  members: TeamMember[],
): { items: WorkloadItem[]; members: TeamMember[] } {
  return {
    items: unassignedItems.slice(0, MAX_ITEMS),
    members: members.slice(0, MAX_MEMBERS),
  };
}
