export {
  assignMeetings,
  createMeetingAssignmentService,
} from "./services/meetingAssignmentService";
export type {
  MeetingAssignmentService,
  MeetingAssignmentServiceConfig,
} from "./services/meetingAssignmentService";

export type {
  AssignmentResult,
  AssignmentSummary,
  LoadState,
  Meeting,
  MeetingAssignment,
  TeamMember,
} from "./types";

export { assignMeetings as assignMeetingsWithContract } from "./service";
export type { AssignMeetingsInput, AssignMeetingsOutput } from "./contract";
export type { IAssignmentEngine } from "./contract";
export { AssignmentError, ErrorCode } from "./contract";
