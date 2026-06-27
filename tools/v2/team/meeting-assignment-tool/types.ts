/** A team member who can be assigned to meetings. */
export interface TeamMember {
  id: string;
  name: string;
  /** Role within the team, e.g. "engineer", "designer", "manager". */
  role: string;
  /** Skills relevant for meeting facilitation or subject-matter expertise. */
  skills: string[];
  /** Current number of meetings already assigned this week. */
  currentMeetingLoad: number;
  /** Maximum meetings this member can handle per week. */
  weeklyCapacity: number;
}

/** A meeting that needs to be assigned to a team member. */
export interface Meeting {
  id: string;
  title: string;
  /** ISO-8601 datetime string for the meeting start. */
  scheduledAt: string;
  /** Duration in minutes. */
  durationMinutes: number;
  /** Skills or expertise required to run or attend this meeting. */
  requiredSkills: string[];
  /** Rough effort cost (1 = light, 2 = medium, 3 = heavy). */
  effort: 1 | 2 | 3;
  /** Priority order: higher = more urgent. */
  priority: number;
}

/** Result of assigning a single meeting. */
export interface MeetingAssignment {
  meetingId: string;
  meetingTitle: string;
  assigneeId: string | null;
  assigneeName: string | null;
  /** "assigned" when a suitable member was found; "unassigned" otherwise. */
  status: "assigned" | "unassigned";
  /**
   * Short machine-readable reason:
   *   "matched"        — member had the skills and capacity
   *   "capacity"       — skill match found but all eligible members were at capacity
   *   "skill_mismatch" — no member had the required skills
   */
  reason: "matched" | "capacity" | "skill_mismatch";
  scheduledAt: string;
  durationMinutes: number;
  effort: 1 | 2 | 3;
  priority: number;
}

/** Summary statistics over a batch of assignments. */
export interface AssignmentSummary {
  total: number;
  assigned: number;
  unassigned: number;
  /** Percentage of meetings that were successfully assigned (0–100). */
  coveragePercent: number;
  /** Per-member breakdown of how many meetings were assigned. */
  memberLoad: Record<string, number>;
}

/** Full output of a single assignMeetings() call. */
export interface AssignmentResult {
  assignments: MeetingAssignment[];
  summary: AssignmentSummary;
}

export type LoadState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: T };
