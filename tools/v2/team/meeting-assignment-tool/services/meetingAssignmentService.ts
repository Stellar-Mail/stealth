import type {
  AssignmentResult,
  AssignmentSummary,
  Meeting,
  MeetingAssignment,
  TeamMember,
} from "../types";

import sampleMeetings from "../fixtures/sample-meetings.json";
import sampleMembers from "../fixtures/team-members.json";

// ---------------------------------------------------------------------------
// Pure assignment engine
// ---------------------------------------------------------------------------

/**
 * Assign a list of meetings to team members.
 *
 * Algorithm:
 *   1. Sort meetings by priority descending, then effort ascending (cheapest
 *      high-priority items first to preserve capacity for later items).
 *   2. For each meeting find members whose skill set is a superset of the
 *      meeting's requiredSkills.
 *   3. Among skill-matching members, discard those whose remaining capacity
 *      (weeklyCapacity − currentMeetingLoad) is less than the meeting effort.
 *   4. Pick the eligible member with the lowest current load; on a tie prefer
 *      the one with the higher capacity.
 *   5. Mutate a local load counter so subsequent meetings see updated loads.
 *
 * Inputs, outputs, and error states
 * ----------------------------------
 * Input:
 *   - `teamMembers` — snapshot of team members with current loads.
 *   - `meetings`    — list of meetings that need to be assigned.
 *
 * Output:  AssignmentResult { assignments[], summary }
 *
 * Error states (thrown):
 *   - TypeError if either argument is not an array.
 *
 * Loading states are handled by the service wrapper (createMeetingAssignmentService).
 */
export function assignMeetings({
  teamMembers,
  meetings,
}: {
  teamMembers: TeamMember[];
  meetings: Meeting[];
}): AssignmentResult {
  if (!Array.isArray(teamMembers)) throw new TypeError("teamMembers must be an array");
  if (!Array.isArray(meetings)) throw new TypeError("meetings must be an array");

  // Working copy so we can mutate loads without touching the originals
  const members = teamMembers.map((m) => ({ ...m, skills: new Set(m.skills) }));

  const sorted = [...meetings].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.effort - b.effort;
  });

  const memberLoad: Record<string, number> = {};
  for (const m of members) memberLoad[m.id] = m.currentMeetingLoad;

  const assignments: MeetingAssignment[] = sorted.map((meeting) => {
    const required = new Set(meeting.requiredSkills);

    const skillMatches = members.filter(
      (m) => required.size === 0 || [...required].every((s) => m.skills.has(s)),
    );

    const eligible = skillMatches.filter(
      (m) => m.weeklyCapacity - memberLoad[m.id] >= meeting.effort,
    );

    const assignee = pickBestMember(eligible, memberLoad);

    let reason: MeetingAssignment["reason"];
    if (assignee) {
      reason = "matched";
      memberLoad[assignee.id] += meeting.effort;
    } else if (skillMatches.length > 0) {
      reason = "capacity";
    } else {
      reason = "skill_mismatch";
    }

    return {
      meetingId: meeting.id,
      meetingTitle: meeting.title,
      assigneeId: assignee?.id ?? null,
      assigneeName: assignee?.name ?? null,
      status: assignee ? "assigned" : "unassigned",
      reason,
      scheduledAt: meeting.scheduledAt,
      durationMinutes: meeting.durationMinutes,
      effort: meeting.effort,
      priority: meeting.priority,
    };
  });

  // Restore original input order
  const idToAssignment = new Map(assignments.map((a) => [a.meetingId, a]));
  const orderedAssignments = meetings.map((m) => idToAssignment.get(m.id)!);

  const summary = buildSummary(orderedAssignments, memberLoad, teamMembers);

  return { assignments: orderedAssignments, summary };
}

function pickBestMember(
  eligible: Array<TeamMember & { skills: Set<string> }>,
  currentLoad: Record<string, number>,
): (TeamMember & { skills: Set<string> }) | null {
  if (eligible.length === 0) return null;
  return eligible.reduce((best, m) => {
    const bLoad = currentLoad[best.id];
    const mLoad = currentLoad[m.id];
    if (mLoad !== bLoad) return mLoad < bLoad ? m : best;
    return m.weeklyCapacity > best.weeklyCapacity ? m : best;
  });
}

function buildSummary(
  assignments: MeetingAssignment[],
  finalLoad: Record<string, number>,
  original: TeamMember[],
): AssignmentSummary {
  const total = assignments.length;
  const assigned = assignments.filter((a) => a.status === "assigned").length;

  const memberLoad: Record<string, number> = {};
  for (const m of original) {
    const added = (finalLoad[m.id] ?? m.currentMeetingLoad) - m.currentMeetingLoad;
    memberLoad[m.id] = added;
  }

  return {
    total,
    assigned,
    unassigned: total - assigned,
    coveragePercent: total === 0 ? 0 : Math.round((assigned / total) * 100),
    memberLoad,
  };
}

// ---------------------------------------------------------------------------
// Service factory (async wrapper with simulated latency for UI dev)
// ---------------------------------------------------------------------------

export interface MeetingAssignmentServiceConfig {
  /** Simulate network-like delay. Default: true. */
  simulateDelay?: boolean;
  /** Delay in ms. Default: 600. */
  delayMs?: number;
  /** Probability (0–1) of a simulated failure. Default: 0. */
  failureRate?: number;
}

export function createMeetingAssignmentService(config: MeetingAssignmentServiceConfig = {}) {
  const { simulateDelay = true, delayMs = 600, failureRate = 0 } = config;

  const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  async function getTeamMembers(): Promise<TeamMember[]> {
    if (simulateDelay) await delay(delayMs / 2);
    return sampleMembers as TeamMember[];
  }

  async function getMeetings(): Promise<Meeting[]> {
    if (simulateDelay) await delay(delayMs / 2);
    return sampleMeetings as Meeting[];
  }

  async function assign(
    teamMembers?: TeamMember[],
    meetings?: Meeting[],
  ): Promise<AssignmentResult> {
    if (simulateDelay) await delay(delayMs);

    if (Math.random() < failureRate) {
      throw new Error("Meeting assignment service failed (simulated).");
    }

    const members = teamMembers ?? (sampleMembers as TeamMember[]);
    const mtgs = meetings ?? (sampleMeetings as Meeting[]);

    return assignMeetings({ teamMembers: members, meetings: mtgs });
  }

  return { getTeamMembers, getMeetings, assign, assignMeetings };
}

export type MeetingAssignmentService = ReturnType<typeof createMeetingAssignmentService>;
