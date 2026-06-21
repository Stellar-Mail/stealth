export const MEETING_ASSIGNMENT_GUARD_LIMITS = Object.freeze({
  maxTeamMembers: 100,
  maxMeetings: 250,
  maxSkillsPerItem: 20,
  maxSkillChars: 80,
  maxIdChars: 80,
  maxNameChars: 120,
  maxRoleChars: 80,
  maxTitleChars: 180,
  maxDurationMinutes: 480,
  maxPriority: 100,
  maxWeeklyCapacity: 80,
  maxCurrentMeetingLoad: 80,
});

const CONTROL_CHAR_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const WHITESPACE_PATTERN = /[ \t]+/g;
const VALID_EFFORT = new Set([1, 2, 3]);

function coerceString(value) {
  return typeof value === "string" ? value : "";
}

export function cleanMeetingAssignmentText(value, maxChars) {
  return coerceString(value)
    .replace(CONTROL_CHAR_PATTERN, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(WHITESPACE_PATTERN, " ").trim())
    .join("\n")
    .trim()
    .slice(0, maxChars);
}

function boundedInteger(value, min, max, fallback) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(value), min), max);
}

function normalizeSkills(skills, limits) {
  if (!Array.isArray(skills)) {
    return [];
  }

  const normalized = [];
  const seen = new Set();

  for (const skill of skills.slice(0, limits.maxSkillsPerItem)) {
    const cleaned = cleanMeetingAssignmentText(skill, limits.maxSkillChars).toLowerCase();
    if (cleaned && !seen.has(cleaned)) {
      seen.add(cleaned);
      normalized.push(cleaned);
    }
  }

  return normalized;
}

function hasValidScheduledAt(value) {
  const cleaned = cleanMeetingAssignmentText(value, 80);
  return cleaned.length > 0 && !Number.isNaN(Date.parse(cleaned));
}

function normalizeTeamMember(member, index, limits) {
  if (!member || typeof member !== "object" || Array.isArray(member)) {
    return {
      error: {
        field: `teamMembers[${index}]`,
        code: "invalid_member",
        message: "Expected a team member object.",
      },
    };
  }

  const id = cleanMeetingAssignmentText(member.id, limits.maxIdChars);
  const name = cleanMeetingAssignmentText(member.name, limits.maxNameChars);
  const role = cleanMeetingAssignmentText(member.role, limits.maxRoleChars);
  const skills = normalizeSkills(member.skills, limits);

  if (!id || !name) {
    return {
      error: {
        field: `teamMembers[${index}]`,
        code: "missing_member_identity",
        message: "Team members need both id and name before assignment.",
      },
    };
  }

  return {
    value: {
      id,
      name,
      role,
      skills,
      currentMeetingLoad: boundedInteger(
        member.currentMeetingLoad,
        0,
        limits.maxCurrentMeetingLoad,
        0,
      ),
      weeklyCapacity: boundedInteger(member.weeklyCapacity, 0, limits.maxWeeklyCapacity, 0),
    },
  };
}

function normalizeMeeting(meeting, index, limits) {
  if (!meeting || typeof meeting !== "object" || Array.isArray(meeting)) {
    return {
      error: {
        field: `meetings[${index}]`,
        code: "invalid_meeting",
        message: "Expected a meeting object.",
      },
    };
  }

  const id = cleanMeetingAssignmentText(meeting.id, limits.maxIdChars);
  const title = cleanMeetingAssignmentText(meeting.title, limits.maxTitleChars);
  const scheduledAt = cleanMeetingAssignmentText(meeting.scheduledAt, 80);

  if (!id || !title) {
    return {
      error: {
        field: `meetings[${index}]`,
        code: "missing_meeting_identity",
        message: "Meetings need both id and title before assignment.",
      },
    };
  }

  if (!hasValidScheduledAt(scheduledAt)) {
    return {
      error: {
        field: `meetings[${index}].scheduledAt`,
        code: "invalid_scheduled_at",
        message: "Meeting scheduledAt must be a parseable ISO-like datetime string.",
      },
    };
  }

  const effort = Number(meeting.effort);
  if (!VALID_EFFORT.has(effort)) {
    return {
      error: {
        field: `meetings[${index}].effort`,
        code: "invalid_effort",
        message: "Meeting effort must be 1, 2, or 3.",
      },
    };
  }

  return {
    value: {
      id,
      title,
      scheduledAt,
      durationMinutes: boundedInteger(
        meeting.durationMinutes,
        1,
        limits.maxDurationMinutes,
        30,
      ),
      requiredSkills: normalizeSkills(meeting.requiredSkills, limits),
      effort,
      priority: boundedInteger(meeting.priority, 0, limits.maxPriority, 0),
    },
  };
}

export function prepareMeetingAssignmentInput(input, options = {}) {
  const limits = { ...MEETING_ASSIGNMENT_GUARD_LIMITS, ...options };

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      ok: false,
      errors: [
        {
          field: "request",
          code: "invalid_request",
          message: "Expected a meeting assignment request object.",
        },
      ],
    };
  }

  const errors = [];
  const warnings = [];

  if (!Array.isArray(input.teamMembers)) {
    errors.push({
      field: "teamMembers",
      code: "invalid_team_members",
      message: "teamMembers must be an array.",
    });
  }

  if (!Array.isArray(input.meetings)) {
    errors.push({
      field: "meetings",
      code: "invalid_meetings",
      message: "meetings must be an array.",
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const rawMembers = input.teamMembers.slice(0, limits.maxTeamMembers);
  const rawMeetings = input.meetings.slice(0, limits.maxMeetings);

  if (input.teamMembers.length > rawMembers.length) {
    warnings.push({
      field: "teamMembers",
      code: "team_members_truncated",
      message: `Only the first ${limits.maxTeamMembers} team members are reviewed.`,
    });
  }

  if (input.meetings.length > rawMeetings.length) {
    warnings.push({
      field: "meetings",
      code: "meetings_truncated",
      message: `Only the first ${limits.maxMeetings} meetings are reviewed.`,
    });
  }

  const teamMembers = [];
  const seenMembers = new Set();
  for (const [index, member] of rawMembers.entries()) {
    const normalized = normalizeTeamMember(member, index, limits);
    if (normalized.error) {
      errors.push(normalized.error);
      continue;
    }
    if (seenMembers.has(normalized.value.id)) {
      errors.push({
        field: `teamMembers[${index}].id`,
        code: "duplicate_member_id",
        message: "Team member ids must be unique in a single assignment request.",
      });
      continue;
    }
    seenMembers.add(normalized.value.id);
    teamMembers.push(normalized.value);
  }

  const meetings = [];
  const seenMeetings = new Set();
  for (const [index, meeting] of rawMeetings.entries()) {
    const normalized = normalizeMeeting(meeting, index, limits);
    if (normalized.error) {
      errors.push(normalized.error);
      continue;
    }
    if (seenMeetings.has(normalized.value.id)) {
      errors.push({
        field: `meetings[${index}].id`,
        code: "duplicate_meeting_id",
        message: "Meeting ids must be unique in a single assignment request.",
      });
      continue;
    }
    seenMeetings.add(normalized.value.id);
    meetings.push(normalized.value);
  }

  if (teamMembers.length === 0) {
    errors.push({
      field: "teamMembers",
      code: "empty_team",
      message: "At least one valid team member is required before assignment.",
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }

  return {
    ok: true,
    value: {
      teamMembers,
      meetings,
      warnings,
      truncated: {
        teamMembers: input.teamMembers.length > rawMembers.length,
        meetings: input.meetings.length > rawMeetings.length,
      },
    },
  };
}

export function estimateMeetingAssignmentWork(input, options = {}) {
  const limits = { ...MEETING_ASSIGNMENT_GUARD_LIMITS, ...options };
  const memberCount = Array.isArray(input?.teamMembers)
    ? Math.min(input.teamMembers.length, limits.maxTeamMembers)
    : 0;
  const meetingCount = Array.isArray(input?.meetings)
    ? Math.min(input.meetings.length, limits.maxMeetings)
    : 0;

  return {
    memberCount,
    meetingCount,
    skillComparisons: memberCount * meetingCount,
    shouldDefer: memberCount * meetingCount > limits.maxTeamMembers * 50,
  };
}
