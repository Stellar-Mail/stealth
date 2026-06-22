/**
 * Security and performance guards for Manager Review Queue.
 *
 * All functions are pure and synchronous — no I/O, no side effects.
 * Designed to be called at the entry point of any service layer function
 * before touching business logic or iterating over collections.
 */

// ---------------------------------------------------------------------------
// Constants / allowlists
// ---------------------------------------------------------------------------

const ALLOWED_STATUSES = new Set(["pending", "approved", "rejected", "escalated"]);
const ALLOWED_PRIORITIES = new Set(["low", "medium", "high", "critical"]);

const LIMITS = {
  MAX_REVIEW_ID_LENGTH: 128,
  MAX_SUBMITTER_EMAIL_LENGTH: 254, // RFC 5321
  MAX_NOTE_LENGTH: 4_000,
  MAX_SUBJECT_LENGTH: 998, // RFC 5322 line limit
  MAX_QUEUE_SIZE: 200, // items safe to process in one pass
  MAX_HISTORY_SIZE: 500, // audit trail entries safe to scan
  MAX_ATTACHMENT_COUNT: 50,
  MAX_TAG_COUNT: 20,
  MAX_TAG_LENGTH: 64,
};

const REVIEW_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class ReviewValidationError extends Error {
  /**
   * @param {string} message
   * @param {string} field
   */
  constructor(message, field) {
    super(message);
    this.name = "ReviewValidationError";
    this.field = field;
  }
}

// ---------------------------------------------------------------------------
// Field-level validators
// ---------------------------------------------------------------------------

/**
 * Validate a review item ID.
 * Rejects path-traversal characters, spaces, and oversized values.
 * @param {unknown} id
 * @returns {string}
 */
export function validateReviewId(id) {
  if (typeof id !== "string" || id.length === 0) {
    throw new ReviewValidationError("reviewId must be a non-empty string", "reviewId");
  }
  if (id.length > LIMITS.MAX_REVIEW_ID_LENGTH) {
    throw new ReviewValidationError(
      `reviewId exceeds max length of ${LIMITS.MAX_REVIEW_ID_LENGTH}`,
      "reviewId",
    );
  }
  if (!REVIEW_ID_PATTERN.test(id)) {
    throw new ReviewValidationError(
      "reviewId contains illegal characters — only alphanumeric, _ and - are allowed",
      "reviewId",
    );
  }
  return id;
}

/**
 * Validate a status value against the allowlist.
 * @param {unknown} status
 * @returns {string}
 */
export function validateStatus(status) {
  if (typeof status !== "string" || status.length === 0) {
    throw new ReviewValidationError("status must be a non-empty string", "status");
  }
  if (!ALLOWED_STATUSES.has(status)) {
    throw new ReviewValidationError(
      `"${status}" is not a recognised status — must be one of: ${[...ALLOWED_STATUSES].join(", ")}`,
      "status",
    );
  }
  return status;
}

/**
 * Validate a priority value against the allowlist.
 * @param {unknown} priority
 * @returns {string}
 */
export function validatePriority(priority) {
  if (typeof priority !== "string" || priority.length === 0) {
    throw new ReviewValidationError("priority must be a non-empty string", "priority");
  }
  if (!ALLOWED_PRIORITIES.has(priority)) {
    throw new ReviewValidationError(
      `"${priority}" is not a recognised priority — must be one of: ${[...ALLOWED_PRIORITIES].join(", ")}`,
      "priority",
    );
  }
  return priority;
}

/**
 * Validate a submitter email address.
 * Guards against header injection (CR/LF/null), missing parts, and oversized values.
 * @param {unknown} email
 * @returns {string}
 */
export function validateSubmitterEmail(email) {
  if (typeof email !== "string" || email.length === 0) {
    throw new ReviewValidationError("submitterEmail must be a non-empty string", "submitterEmail");
  }
  if (email.length > LIMITS.MAX_SUBMITTER_EMAIL_LENGTH) {
    throw new ReviewValidationError(
      `submitterEmail exceeds RFC 5321 max length of ${LIMITS.MAX_SUBMITTER_EMAIL_LENGTH}`,
      "submitterEmail",
    );
  }
  // Reject header injection characters
  if (/[\r\n\0]/.test(email)) {
    throw new ReviewValidationError(
      "submitterEmail contains illegal control characters",
      "submitterEmail",
    );
  }
  const at = email.lastIndexOf("@");
  if (at < 1 || at === email.length - 1) {
    throw new ReviewValidationError(
      "submitterEmail is malformed — missing local part or domain",
      "submitterEmail",
    );
  }
  return email;
}

/**
 * Sanitize a free-text review note submitted by a user.
 * Removes control characters, trims whitespace, enforces length cap.
 * Does NOT HTML-escape — that is the renderer's responsibility.
 * @param {unknown} note
 * @returns {string}
 */
export function sanitizeNote(note) {
  if (typeof note !== "string") return "";
  // Strip control characters (except tab and newline which are valid in notes)
  let out = note.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "");
  out = out.trim();
  if (out.length > LIMITS.MAX_NOTE_LENGTH) {
    out = out.slice(0, LIMITS.MAX_NOTE_LENGTH);
  }
  return out;
}

/**
 * Sanitize an email subject line.
 * Strips control characters and enforces RFC 5322 line-length cap.
 * @param {unknown} subject
 * @returns {string}
 */
export function sanitizeSubject(subject) {
  if (typeof subject !== "string") return "";
  let out = subject.replace(/[\r\n\0\x01-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "");
  out = out.trim();
  if (out.length > LIMITS.MAX_SUBJECT_LENGTH) {
    out = out.slice(0, LIMITS.MAX_SUBJECT_LENGTH);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Object-level validator
// ---------------------------------------------------------------------------

/**
 * Validate a complete review request object.
 * Throws ReviewValidationError on the first invalid field encountered.
 * @param {unknown} req
 * @returns {true}
 */
export function validateReviewRequest(req) {
  if (req === null || typeof req !== "object" || Array.isArray(req)) {
    throw new ReviewValidationError("review request must be a plain object", "request");
  }
  validateReviewId(req.reviewId);
  validateStatus(req.status);
  validatePriority(req.priority);
  validateSubmitterEmail(req.submitterEmail);
  return true;
}

// ---------------------------------------------------------------------------
// Performance guards — reject oversized collections before iterating
// ---------------------------------------------------------------------------

/**
 * Guard against processing an oversized review queue in one pass.
 * Callers should paginate and call per-page.
 * @param {unknown} items
 * @returns {true}
 */
export function guardQueueSize(items) {
  if (!Array.isArray(items)) {
    throw new ReviewValidationError("queue items must be an array", "items");
  }
  if (items.length > LIMITS.MAX_QUEUE_SIZE) {
    throw new ReviewValidationError(
      `queue size ${items.length} exceeds safe limit of ${LIMITS.MAX_QUEUE_SIZE} — paginate before processing`,
      "items",
    );
  }
  return true;
}

/**
 * Guard against scanning an oversized review history / audit trail.
 * @param {unknown} entries
 * @returns {true}
 */
export function guardHistorySize(entries) {
  if (!Array.isArray(entries)) {
    throw new ReviewValidationError("history entries must be an array", "entries");
  }
  if (entries.length > LIMITS.MAX_HISTORY_SIZE) {
    throw new ReviewValidationError(
      `history size ${entries.length} exceeds safe limit of ${LIMITS.MAX_HISTORY_SIZE} — paginate before scanning`,
      "entries",
    );
  }
  return true;
}

/**
 * Guard against iterating over an oversized attachment list during review.
 * @param {unknown} attachments
 * @returns {true}
 */
export function guardAttachmentCount(attachments) {
  if (!Array.isArray(attachments)) {
    throw new ReviewValidationError("attachments must be an array", "attachments");
  }
  if (attachments.length > LIMITS.MAX_ATTACHMENT_COUNT) {
    throw new ReviewValidationError(
      `attachment count ${attachments.length} exceeds safe limit of ${LIMITS.MAX_ATTACHMENT_COUNT} — paginate before reviewing`,
      "attachments",
    );
  }
  return true;
}

/**
 * Guard against tag arrays that are too large or contain oversized tag strings.
 * @param {unknown} tags
 * @returns {true}
 */
export function guardTags(tags) {
  if (!Array.isArray(tags)) {
    throw new ReviewValidationError("tags must be an array", "tags");
  }
  if (tags.length > LIMITS.MAX_TAG_COUNT) {
    throw new ReviewValidationError(
      `tag count ${tags.length} exceeds safe limit of ${LIMITS.MAX_TAG_COUNT}`,
      "tags",
    );
  }
  for (let i = 0; i < tags.length; i++) {
    if (typeof tags[i] !== "string" || tags[i].length === 0) {
      throw new ReviewValidationError(`tag at index ${i} must be a non-empty string`, "tags");
    }
    if (tags[i].length > LIMITS.MAX_TAG_LENGTH) {
      throw new ReviewValidationError(
        `tag at index ${i} exceeds max length of ${LIMITS.MAX_TAG_LENGTH}`,
        "tags",
      );
    }
  }
  return true;
}

export { LIMITS, ALLOWED_STATUSES, ALLOWED_PRIORITIES };
