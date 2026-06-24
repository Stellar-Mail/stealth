import type { ValidationIssue } from "./validation-types";
import type { CalendarEventEditorState } from "./types/calendarEvent";

const SAFE_DOMAIN_PATTERN = /(@example\.(com|org)|@([\w.-]+)?\.stealth\.demo)$/i;

export function validateCalendarEventEditor(state: CalendarEventEditorState): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const datasetId = "calendar-event-editor";

  if (!state.title.trim()) {
    issues.push({
      id: "event-title-empty",
      severity: "error",
      fieldPath: "title",
      message: "Event title is required.",
      datasetId,
      hint: "Enter a title for the calendar event.",
    });
  }

  if (!state.startTime.trim()) {
    issues.push({
      id: "event-start-time-empty",
      severity: "error",
      fieldPath: "startTime",
      message: "Start time is required.",
      datasetId,
      hint: "Pick a start date and time.",
    });
  }

  if (!state.endTime.trim()) {
    issues.push({
      id: "event-end-time-empty",
      severity: "error",
      fieldPath: "endTime",
      message: "End time is required.",
      datasetId,
      hint: "Pick an end date and time.",
    });
  }

  if (state.startTime.trim() && state.endTime.trim()) {
    const start = new Date(state.startTime);
    const end = new Date(state.endTime);
    if (isNaN(start.getTime())) {
      issues.push({
        id: "event-start-time-invalid",
        severity: "error",
        fieldPath: "startTime",
        message: "Start time is not a valid date.",
        datasetId,
        hint: "Enter a date in yyyy-MM-ddTHH:mm format.",
      });
    }
    if (isNaN(end.getTime())) {
      issues.push({
        id: "event-end-time-invalid",
        severity: "error",
        fieldPath: "endTime",
        message: "End time is not a valid date.",
        datasetId,
        hint: "Enter a date in yyyy-MM-ddTHH:mm format.",
      });
    }
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end <= start) {
      issues.push({
        id: "event-end-before-start",
        severity: "error",
        fieldPath: "endTime",
        message: "End time must be after start time.",
        datasetId,
        hint: "Choose an end time that is later than the start time.",
      });
    }
  }

  if (state.attendees.length > 0) {
    state.attendees.forEach((attendee, idx) => {
      const normalized = attendee.replace("*", "@");
      const hasAt = normalized.includes("@");
      if (!hasAt) {
        issues.push({
          id: `event-attendee-${idx}-invalid`,
          severity: "error",
          fieldPath: `attendees[${idx}]`,
          message: `Attendee "${attendee}" is not a valid email or federated address.`,
          datasetId,
          hint: "Use format like user@example.com or user*federation.",
        });
        return;
      }
      const isSafe = SAFE_DOMAIN_PATTERN.test(normalized);
      if (!isSafe) {
        issues.push({
          id: `event-attendee-${idx}-unsafe-domain`,
          severity: "warning",
          fieldPath: `attendees[${idx}]`,
          message: `Attendee "${attendee}" uses an external or unverified domain for demo data.`,
          datasetId,
          hint: "Stick to example.com, example.org, or *.stealth.demo.",
        });
      }
    });
  }

  return issues;
}
