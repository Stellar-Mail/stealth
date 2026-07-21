import { assignMeetings as coreAssign } from "./services/meetingAssignmentService";
import type { AssignMeetingsInput, AssignMeetingsOutput, IAssignmentEngine } from "./contract";
import { AssignmentError, ErrorCode } from "./contract";

export const assignMeetings: IAssignmentEngine["assign"] = (
  input: AssignMeetingsInput,
): AssignMeetingsOutput => {
  try {
    return coreAssign(input);
  } catch (err) {
    if (err instanceof TypeError) {
      const code = err.message.includes("teamMembers")
        ? ErrorCode.INVALID_TEAM_MEMBERS
        : ErrorCode.INVALID_MEETINGS;
      throw new AssignmentError(code, err.message);
    }
    throw err;
  }
};

export type { IAssignmentEngine, AssignMeetingsInput, AssignMeetingsOutput };
export { AssignmentError, ErrorCode } from "./contract";
