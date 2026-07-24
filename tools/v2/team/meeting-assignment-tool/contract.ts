import type {
  Meeting,
  MeetingAssignment,
  AssignmentResult,
  AssignmentSummary,
  TeamMember,
} from "./types";

export type { Meeting, TeamMember, MeetingAssignment, AssignmentResult, AssignmentSummary };

export interface AssignMeetingsInput {
  teamMembers: TeamMember[];
  meetings: Meeting[];
}

export type AssignMeetingsOutput = AssignmentResult;

export const ErrorCode = {
  INVALID_TEAM_MEMBERS: "ERR_INVALID_TEAM_MEMBERS",
  INVALID_MEETINGS: "ERR_INVALID_MEETINGS",
  ASSIGNMENT_FAILED: "ERR_ASSIGNMENT_FAILED",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export class AssignmentError extends Error {
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AssignmentError";
    this.code = code;
    this.details = details;
  }
}

export interface IAssignmentEngine {
  assign(input: AssignMeetingsInput): AssignMeetingsOutput;
}
