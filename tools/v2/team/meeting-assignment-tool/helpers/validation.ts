/**
 * Validation and sanitization helpers for the Meeting Assignment Tool.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;

export interface MeetingPayload {
  meetingId: string;
  title: string;
  description?: string;
  assignees: string[];
}

/**
 * Strips dangerous HTML tags from strings.
 * @param input The raw string input.
 * @returns Sanitized string.
 */
export function sanitizeText(input: string): string {
  if (!input) return "";
  // Basic sanitization replacing < and >
  return input.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Validates and sanitizes meeting titles.
 */
export function sanitizeMeetingTitle(title: string): string {
  if (!title) throw new Error("Meeting title is required.");
  const sanitized = sanitizeText(title.trim());
  if (sanitized.length > MAX_TITLE_LENGTH) {
    throw new Error(`Meeting title exceeds maximum length of ${MAX_TITLE_LENGTH} characters.`);
  }
  return sanitized;
}

/**
 * Validates an email address format.
 */
export function validateAssigneeEmail(email: string): boolean {
  if (!email) return false;
  return EMAIL_REGEX.test(email);
}

/**
 * Validates the base structural integrity of a meeting payload.
 */
export function validateMeetingPayload(payload: any): payload is MeetingPayload {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid payload: Must be an object.");
  }

  if (!payload.meetingId || typeof payload.meetingId !== "string") {
    throw new Error("Invalid payload: Missing or invalid meetingId.");
  }

  if (!payload.title || typeof payload.title !== "string") {
    throw new Error("Invalid payload: Missing or invalid title.");
  }

  if (!Array.isArray(payload.assignees)) {
    throw new Error("Invalid payload: assignees must be an array.");
  }

  // Validate each assignee
  payload.assignees.forEach((email: any) => {
    if (typeof email !== "string" || !validateAssigneeEmail(email)) {
      throw new Error(`Invalid payload: Invalid assignee email format -> ${email}`);
    }
  });

  if (payload.description && typeof payload.description !== "string") {
    throw new Error("Invalid payload: description must be a string.");
  }

  if (payload.description && payload.description.length > MAX_DESCRIPTION_LENGTH) {
    throw new Error(`Invalid payload: description exceeds ${MAX_DESCRIPTION_LENGTH} characters.`);
  }

  return true;
}
