import React from "react";
import type { MeetingAssignment } from "../types";

interface AssignmentRowProps {
  assignment: MeetingAssignment;
}

const REASON_LABEL: Record<MeetingAssignment["reason"], string> = {
  matched: "Matched",
  capacity: "No capacity",
  skill_mismatch: "No skill match",
};

export const AssignmentRow: React.FC<AssignmentRowProps> = ({ assignment }) => {
  const isAssigned = assignment.status === "assigned";
  return (
    <li className="flex items-center justify-between gap-4 rounded-md border border-border p-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{assignment.meetingTitle}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {new Date(assignment.scheduledAt).toLocaleString()} - {assignment.durationMinutes} min -
          priority {assignment.priority}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm text-foreground">
          {isAssigned ? assignment.assigneeName : "Unassigned"}
        </p>
        <span
          className={
            isAssigned
              ? "mt-1 inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
              : "mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
          }
        >
          {REASON_LABEL[assignment.reason]}
        </span>
      </div>
    </li>
  );
};
