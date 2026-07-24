import React from "react";
import type { MeetingAssignment } from "../types";
import { AssignmentRow } from "./AssignmentRow";

interface AssignmentListProps {
  assignments: MeetingAssignment[];
}

export const AssignmentList: React.FC<AssignmentListProps> = ({ assignments }) => {
  return (
    <ul className="flex flex-col gap-2" aria-label="Meeting assignments">
      {assignments.map((assignment) => (
        <AssignmentRow key={assignment.meetingId} assignment={assignment} />
      ))}
    </ul>
  );
};
