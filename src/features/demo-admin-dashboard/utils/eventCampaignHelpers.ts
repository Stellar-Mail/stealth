import type { EventCampaignConfig, EventCampaignFixture, EventCampaignKind } from "../types/eventCampaign";

const SAFE_DOMAIN_PATTERN = /(@example\.(com|org)|@([\w.-]+)?\.stealth\.demo)$/i;

export interface EventCampaignValidationIssue {
  fieldPath: string;
  message: string;
  severity: "error" | "warning";
}

export function validateEventCampaignConfig(
  config: EventCampaignConfig,
): EventCampaignValidationIssue[] {
  const issues: EventCampaignValidationIssue[] = [];

  if (!config.id.trim()) {
    issues.push({
      fieldPath: "config.id",
      message: "Campaign ID is required.",
      severity: "error",
    });
  }

  if (!config.name.trim()) {
    issues.push({
      fieldPath: "config.name",
      message: "Campaign name is required.",
      severity: "error",
    });
  }

  const validKinds: EventCampaignKind[] = [
    "conference",
    "workshop",
    "meetup",
    "webinar",
  ];
  if (!validKinds.includes(config.kind)) {
    issues.push({
      fieldPath: "config.kind",
      message: `Invalid event kind "${config.kind}". Must be one of: ${validKinds.join(", ")}.`,
      severity: "error",
    });
  }

  if (!config.eventDate.trim()) {
    issues.push({
      fieldPath: "config.eventDate",
      message: "Event date is required.",
      severity: "error",
    });
  }

  if (config.capacity < 0) {
    issues.push({
      fieldPath: "config.capacity",
      message: "Capacity must be zero or greater.",
      severity: "error",
    });
  }

  if (!config.organizerEmail.trim()) {
    issues.push({
      fieldPath: "config.organizerEmail",
      message: "Organizer email is required.",
      severity: "error",
    });
  } else {
    const normalized = config.organizerEmail.replace("*", "@");
    if (!SAFE_DOMAIN_PATTERN.test(normalized)) {
      issues.push({
        fieldPath: "config.organizerEmail",
        message:
          "Organizer email domain should be a safe demo domain (example.com, example.org, or *.stealth.demo).",
        severity: "warning",
      });
    }
  }

  return issues;
}

export function validateEventCampaignFixture(
  fixture: EventCampaignFixture,
): EventCampaignValidationIssue[] {
  const issues: EventCampaignValidationIssue[] = validateEventCampaignConfig(
    fixture.config,
  );

  if (fixture.timelinePhases.length === 0) {
    issues.push({
      fieldPath: "timelinePhases",
      message: "At least one timeline phase is required.",
      severity: "error",
    });
  }

  if (fixture.messages.length === 0) {
    issues.push({
      fieldPath: "messages",
      message: "At least one campaign message is required.",
      severity: "error",
    });
  }

  fixture.messages.forEach((msg, index) => {
    if (!msg.subject.trim()) {
      issues.push({
        fieldPath: `messages[${index}].subject`,
        message: "Message subject is required.",
        severity: "error",
      });
    }
    if (!msg.body.trim()) {
      issues.push({
        fieldPath: `messages[${index}].body`,
        message: "Message body is required.",
        severity: "error",
      });
    }
  });

  fixture.calendarEvents.forEach((evt, index) => {
    if (!evt.title.trim()) {
      issues.push({
        fieldPath: `calendarEvents[${index}].title`,
        message: "Calendar event title is required.",
        severity: "error",
      });
    }
    if (!evt.startTime.trim() || !evt.endTime.trim()) {
      issues.push({
        fieldPath: `calendarEvents[${index}]`,
        message: "Calendar event must have a start and end time.",
        severity: "error",
      });
    }
    if (evt.startTime && evt.endTime && evt.startTime >= evt.endTime) {
      issues.push({
        fieldPath: `calendarEvents[${index}].endTime`,
        message: "End time must be after start time.",
        severity: "error",
      });
    }
  });

  return issues;
}

export function buildEventCampaignSummary(
  fixture: EventCampaignFixture,
): string {
  const { config, timelinePhases, messages, calendarEvents } = fixture;
  const statusFlag = timelinePhases.some(
    (p) => p.phaseKind === "active",
  )
    ? "active"
    : "planned";
  return [
    `${config.name} (${config.kind}) — ${statusFlag}`,
    `  Organizer: ${config.organizer} <${config.organizerEmail}>`,
    `  Event date: ${config.eventDate} at ${config.venue}`,
    `  Capacity: ${config.capacity}`,
    `  Phases: ${timelinePhases.length} (${timelinePhases.map((p) => p.phaseKind).join(", ")})`,
    `  Messages: ${messages.length}`,
    `  Calendar events: ${calendarEvents.length}`,
  ].join("\n");
}
