/**
 * draft-guards.mjs — Shared Draft Collaboration
 *
 * Input validation, text sanitization, and size boundary guards.
 */

export class DraftValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = "DraftValidationError";
    this.field = field;
  }
}

export const LIMITS = {
  MAX_TITLE_LENGTH: 120,
  MAX_SUBJECT_LENGTH: 200,
  MAX_DRAFT_ID_LENGTH: 64,
  MAX_SEARCH_LENGTH: 100,
  MAX_COLLABORATORS: 50,
  MAX_DRAFTS_COUNT: 1000,
};

const DRAFT_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

// Strips HTML script tags and tag brackets to prevent XSS/HTML injection
export function sanitizeText(raw) {
  if (typeof raw !== "string") return "";
  return raw
    .trim()
    .replace(/<[^>]*>/g, "") // Strip HTML tags
    .replace(/[\r\n\0]/g, " "); // Strip header injection and null characters
}

export function validateDraftId(id) {
  if (typeof id !== "string" || id.length === 0) {
    throw new DraftValidationError("id must be a non-empty string", "id");
  }
  if (id.length > LIMITS.MAX_DRAFT_ID_LENGTH) {
    throw new DraftValidationError(
      `id exceeds maximum length of ${LIMITS.MAX_DRAFT_ID_LENGTH}`,
      "id",
    );
  }
  if (!DRAFT_ID_PATTERN.test(id)) {
    throw new DraftValidationError("id contains illegal characters", "id");
  }
  return id;
}

export function validateDraftTitle(title) {
  if (typeof title !== "string" || title.trim().length === 0) {
    throw new DraftValidationError("title must be a non-empty string", "title");
  }
  if (title.length > LIMITS.MAX_TITLE_LENGTH) {
    throw new DraftValidationError(
      `title exceeds maximum length of ${LIMITS.MAX_TITLE_LENGTH}`,
      "title",
    );
  }
  return sanitizeText(title);
}

export function validateDraftSubject(subject) {
  if (subject === undefined || subject === null) {
    return "";
  }
  if (typeof subject !== "string") {
    throw new DraftValidationError("subject must be a string", "subject");
  }
  if (subject.length > LIMITS.MAX_SUBJECT_LENGTH) {
    throw new DraftValidationError(
      `subject exceeds maximum length of ${LIMITS.MAX_SUBJECT_LENGTH}`,
      "subject",
    );
  }
  return sanitizeText(subject);
}

export function validateCollaboratorCount(count) {
  if (count === undefined || count === null) {
    return 1;
  }
  if (!Number.isInteger(count)) {
    throw new DraftValidationError("collaborators must be an integer", "collaborators");
  }
  if (count < 1 || count > LIMITS.MAX_COLLABORATORS) {
    throw new DraftValidationError(
      `collaborators count must be between 1 and ${LIMITS.MAX_COLLABORATORS}`,
      "collaborators",
    );
  }
  return count;
}

export function validateSearchQuery(query) {
  if (typeof query !== "string") return "";
  if (query.length > LIMITS.MAX_SEARCH_LENGTH) {
    throw new DraftValidationError(
      `search query exceeds maximum length of ${LIMITS.MAX_SEARCH_LENGTH}`,
      "search",
    );
  }
  return query.trim().toLowerCase();
}

export function guardDraftsCount(drafts) {
  if (!Array.isArray(drafts)) {
    throw new DraftValidationError("drafts must be an array", "drafts");
  }
  if (drafts.length >= LIMITS.MAX_DRAFTS_COUNT) {
    throw new DraftValidationError(
      `drafts list has reached the safe limit of ${LIMITS.MAX_DRAFTS_COUNT}`,
      "drafts",
    );
  }
  return true;
}

export function validateDraftInput(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new DraftValidationError("draft input must be a plain object", "input");
  }
  const title = validateDraftTitle(input.title);
  const subject = validateDraftSubject(input.subject);
  const collaborators = validateCollaboratorCount(input.collaborators);

  return { title, subject, collaborators };
}
