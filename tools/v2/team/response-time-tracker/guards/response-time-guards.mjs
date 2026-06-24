/**
 * response-time-guards.mjs — Response Time Tracker
 *
 * Input validation, text sanitization, and size boundary guards.
 * All functions are pure and synchronous — no I/O, no side effects.
 */

export class RTTValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = "RTTValidationError";
    this.field = field;
  }
}

export const LIMITS = {
  MAX_ENTRY_ID_LENGTH: 64,
  MAX_THREAD_ID_LENGTH: 64,
  MAX_TEAM_MEMBER_ID_LENGTH: 64,
  MAX_NAME_LENGTH: 200,
  MAX_EMAIL_LENGTH: 254,
  MAX_SUBJECT_LENGTH: 998,
  MAX_ENTRIES_COUNT: 10_000,
  MAX_MEMBERS_COUNT: 500,
  MAX_DATE_RANGE_DAYS: 365,
  MIN_RESPONSE_TIME_MS: 0,
  MAX_RESPONSE_TIME_MS: 7_776_000_000,
};

const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const ALLOWED_STATUSES = new Set(["met", "missed", "breached"]);

export function sanitizeText(raw) {
  if (typeof raw !== "string") return "";
  return raw
    .trim()
    .replace(/<[^>]*>/g, "")
    .replace(/[\r\n\0]/g, " ");
}

export function validateEntryId(id) {
  if (typeof id !== "string" || id.length === 0) {
    throw new RTTValidationError("entryId must be a non-empty string", "entryId");
  }
  if (id.length > LIMITS.MAX_ENTRY_ID_LENGTH) {
    throw new RTTValidationError(
      `entryId exceeds max length of ${LIMITS.MAX_ENTRY_ID_LENGTH}`,
      "entryId",
    );
  }
  if (!ID_PATTERN.test(id)) {
    throw new RTTValidationError(
      "entryId contains illegal characters — only alphanumeric, _ and - are allowed",
      "entryId",
    );
  }
  return id;
}

export function validateThreadId(id) {
  if (typeof id !== "string" || id.length === 0) {
    throw new RTTValidationError("threadId must be a non-empty string", "threadId");
  }
  if (id.length > LIMITS.MAX_THREAD_ID_LENGTH) {
    throw new RTTValidationError(
      `threadId exceeds max length of ${LIMITS.MAX_THREAD_ID_LENGTH}`,
      "threadId",
    );
  }
  if (!ID_PATTERN.test(id)) {
    throw new RTTValidationError(
      "threadId contains illegal characters — only alphanumeric, _ and - are allowed",
      "threadId",
    );
  }
  return id;
}

export function validateTeamMemberId(id) {
  if (typeof id !== "string" || id.length === 0) {
    throw new RTTValidationError("teamMemberId must be a non-empty string", "teamMemberId");
  }
  if (id.length > LIMITS.MAX_TEAM_MEMBER_ID_LENGTH) {
    throw new RTTValidationError(
      `teamMemberId exceeds max length of ${LIMITS.MAX_TEAM_MEMBER_ID_LENGTH}`,
      "teamMemberId",
    );
  }
  if (!ID_PATTERN.test(id)) {
    throw new RTTValidationError(
      "teamMemberId contains illegal characters — only alphanumeric, _ and - are allowed",
      "teamMemberId",
    );
  }
  return id;
}

export function validateEmailField(email) {
  if (typeof email !== "string" || email.length === 0) {
    throw new RTTValidationError("email must be a non-empty string", "email");
  }
  if (email.length > LIMITS.MAX_EMAIL_LENGTH) {
    throw new RTTValidationError(
      `email exceeds max length of ${LIMITS.MAX_EMAIL_LENGTH}`,
      "email",
    );
  }
  if (/[\r\n\0]/.test(email)) {
    throw new RTTValidationError("email contains illegal control characters", "email");
  }
  const at = email.lastIndexOf("@");
  if (at < 1 || at === email.length - 1) {
    throw new RTTValidationError("email is malformed — missing local part or domain", "email");
  }
  return email;
}

export function sanitizeSubject(subject) {
  if (typeof subject !== "string") return "";
  let out = subject.replace(/[\r\n\0\x01-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "");
  out = out.trim();
  if (out.length > LIMITS.MAX_SUBJECT_LENGTH) {
    out = out.slice(0, LIMITS.MAX_SUBJECT_LENGTH);
  }
  return out;
}

export function validateStatus(status) {
  if (typeof status !== "string" || status.length === 0) {
    throw new RTTValidationError("status must be a non-empty string", "status");
  }
  if (!ALLOWED_STATUSES.has(status)) {
    throw new RTTValidationError(
      `"${status}" is not a recognised status — must be one of: ${[...ALLOWED_STATUSES].join(", ")}`,
      "status",
    );
  }
  return status;
}

export function validateDateString(dateStr) {
  if (typeof dateStr !== "string" || dateStr.length === 0) {
    throw new RTTValidationError("dateString must be a non-empty string", "dateString");
  }
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) {
    throw new RTTValidationError("dateString is not a valid date", "dateString");
  }
  return dateStr;
}

export function validateResponseTimeMs(ms) {
  if (typeof ms !== "number" || Number.isNaN(ms)) {
    throw new RTTValidationError("responseTimeMs must be a number", "responseTimeMs");
  }
  if (!Number.isFinite(ms)) {
    throw new RTTValidationError("responseTimeMs must be a finite number", "responseTimeMs");
  }
  if (ms < LIMITS.MIN_RESPONSE_TIME_MS) {
    throw new RTTValidationError(
      `responseTimeMs must be >= ${LIMITS.MIN_RESPONSE_TIME_MS}`,
      "responseTimeMs",
    );
  }
  if (ms > LIMITS.MAX_RESPONSE_TIME_MS) {
    throw new RTTValidationError(
      `responseTimeMs must be <= ${LIMITS.MAX_RESPONSE_TIME_MS}`,
      "responseTimeMs",
    );
  }
  return ms;
}

export function validateDateRange(range) {
  if (range === null || typeof range !== "object" || Array.isArray(range)) {
    throw new RTTValidationError("dateRange must be a plain object", "dateRange");
  }
  const start = validateDateString(range.start);
  const end = validateDateString(range.end);

  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();

  if (endMs < startMs) {
    throw new RTTValidationError("dateRange end must be on or after start", "dateRange");
  }

  const diffDays = (endMs - startMs) / 86_400_000;
  if (diffDays > LIMITS.MAX_DATE_RANGE_DAYS) {
    throw new RTTValidationError(
      `dateRange span (${Math.round(diffDays)} days) exceeds max of ${LIMITS.MAX_DATE_RANGE_DAYS} days`,
      "dateRange",
    );
  }

  return { start, end };
}

export function guardEntriesCount(entries) {
  if (!Array.isArray(entries)) {
    throw new RTTValidationError("entries must be an array", "entries");
  }
  if (entries.length > LIMITS.MAX_ENTRIES_COUNT) {
    throw new RTTValidationError(
      `entries count ${entries.length} exceeds safe limit of ${LIMITS.MAX_ENTRIES_COUNT} — paginate before processing`,
      "entries",
    );
  }
  return true;
}

export function guardMembersCount(members) {
  if (!Array.isArray(members)) {
    throw new RTTValidationError("members must be an array", "members");
  }
  if (members.length > LIMITS.MAX_MEMBERS_COUNT) {
    throw new RTTValidationError(
      `members count ${members.length} exceeds safe limit of ${LIMITS.MAX_MEMBERS_COUNT}`,
      "members",
    );
  }
  return true;
}

export function validateEntryInput(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new RTTValidationError("entry input must be a plain object", "input");
  }
  validateEntryId(input.id);
  validateThreadId(input.threadId);
  sanitizeSubject(input.subject);
  validateEmailField(input.from);
  validateEmailField(input.to);
  validateDateString(input.sentAt);
  validateDateString(input.respondedAt);
  validateResponseTimeMs(input.responseTimeMs);
  validateTeamMemberId(input.teamMemberId);
  validateStatus(input.status);
  return true;
}

export { ALLOWED_STATUSES };
