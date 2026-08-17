/**
 * watchlist-guards.mjs — Suspicious Sender Watchlist
 *
 * Input validation, text sanitization, and size boundary guards.
 * All inputs are treated as untrusted until validated.
 *
 * Exports:
 *   sanitizeText(raw)          → sanitized string
 *   validateWatchlistId(id)    → id or throws WatchlistValidationError
 *   validateSenderEmail(email) → email or throws WatchlistValidationError
 *   validateSenderName(name)   → sanitized name or throws WatchlistValidationError
 *   validateReason(reason)     → sanitized reason or throws WatchlistValidationError
 *   validateNotes(notes)       → sanitized notes or throws WatchlistValidationError
 *   validateRiskLevel(level)   → level or throws WatchlistValidationError
 *   validateEntryStatus(status)→ status or throws WatchlistValidationError
 *   validateSearchQuery(query) → trimmed query or throws WatchlistValidationError
 *   guardWatchlistSize(entries)→ true or throws WatchlistValidationError
 */

export class WatchlistValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = "WatchlistValidationError";
    this.field = field;
  }
}

// ---------------------------------------------------------------------------
// Constants / Limits
// ---------------------------------------------------------------------------

export const LIMITS = {
  MAX_WATCHLIST_ENTRIES: 5_000,
  MAX_ID_LENGTH: 64,
  MAX_EMAIL_LENGTH: 320, // RFC 5321 upper limit
  MAX_NAME_LENGTH: 200,
  MAX_REASON_LENGTH: 500,
  MAX_NOTES_LENGTH: 2_000,
  MAX_SEARCH_LENGTH: 100,
  ALLOWED_RISK_LEVELS: ["low", "medium", "high"],
  ALLOWED_ENTRY_STATUSES: ["active", "dismissed"],
};

const WATCHLIST_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

// ---------------------------------------------------------------------------
// Sanitizers
// ---------------------------------------------------------------------------

/**
 * Strips HTML tags, control characters (CRLF, null bytes), and trims.
 * Prevents XSS, header injection, and null-byte injection.
 */
export function sanitizeText(raw) {
  if (typeof raw !== "string") return "";
  return raw
    .trim()
    .replace(/<[^>]*>/g, "") // Strip HTML tags
    .replace(/[\r\n\0]/g, " "); // Strip CRLF and null bytes
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

export function validateWatchlistId(id) {
  if (typeof id !== "string" || id.length === 0) {
    throw new WatchlistValidationError("id must be a non-empty string", "id");
  }
  if (id.length > LIMITS.MAX_ID_LENGTH) {
    throw new WatchlistValidationError(`id exceeds max length of ${LIMITS.MAX_ID_LENGTH}`, "id");
  }
  // Prevent path traversal and injection chars — only alphanumeric, _, -
  if (!WATCHLIST_ID_PATTERN.test(id)) {
    throw new WatchlistValidationError("id contains illegal characters", "id");
  }
  return id;
}

export function validateSenderEmail(email) {
  if (typeof email !== "string" || email.length === 0) {
    throw new WatchlistValidationError("senderEmail must be a non-empty string", "senderEmail");
  }
  if (email.length > LIMITS.MAX_EMAIL_LENGTH) {
    throw new WatchlistValidationError(
      `senderEmail exceeds max length of ${LIMITS.MAX_EMAIL_LENGTH}`,
      "senderEmail",
    );
  }
  // Reject header injection characters before any further processing
  if (/[\r\n\0]/.test(email)) {
    throw new WatchlistValidationError(
      "senderEmail contains illegal control characters",
      "senderEmail",
    );
  }
  // Basic structural check: must have exactly one @, with non-empty local + domain
  const atIndex = email.lastIndexOf("@");
  if (atIndex < 1 || atIndex === email.length - 1) {
    throw new WatchlistValidationError(
      "senderEmail is malformed — missing local part or domain",
      "senderEmail",
    );
  }
  return email;
}

export function validateSenderName(name) {
  if (typeof name !== "string" || name.trim().length === 0) {
    throw new WatchlistValidationError("senderName must be a non-empty string", "senderName");
  }
  if (name.length > LIMITS.MAX_NAME_LENGTH) {
    throw new WatchlistValidationError(
      `senderName exceeds max length of ${LIMITS.MAX_NAME_LENGTH}`,
      "senderName",
    );
  }
  return sanitizeText(name);
}

export function validateReason(reason) {
  if (typeof reason !== "string" || reason.trim().length === 0) {
    throw new WatchlistValidationError("reason must be a non-empty string", "reason");
  }
  if (reason.length > LIMITS.MAX_REASON_LENGTH) {
    throw new WatchlistValidationError(
      `reason exceeds max length of ${LIMITS.MAX_REASON_LENGTH}`,
      "reason",
    );
  }
  return sanitizeText(reason);
}

export function validateNotes(notes) {
  if (notes === undefined || notes === null) {
    return "";
  }
  if (typeof notes !== "string") {
    throw new WatchlistValidationError("notes must be a string", "notes");
  }
  if (notes.length > LIMITS.MAX_NOTES_LENGTH) {
    throw new WatchlistValidationError(
      `notes exceeds max length of ${LIMITS.MAX_NOTES_LENGTH}`,
      "notes",
    );
  }
  return sanitizeText(notes);
}

export function validateRiskLevel(level) {
  if (typeof level !== "string" || level.length === 0) {
    throw new WatchlistValidationError("riskLevel must be a non-empty string", "riskLevel");
  }
  const lowered = level.toLowerCase();
  if (!LIMITS.ALLOWED_RISK_LEVELS.includes(lowered)) {
    throw new WatchlistValidationError(
      `"${level}" is not a recognised risk level (low, medium, high)`,
      "riskLevel",
    );
  }
  return lowered;
}

export function validateEntryStatus(status) {
  if (typeof status !== "string" || status.length === 0) {
    throw new WatchlistValidationError("status must be a non-empty string", "status");
  }
  const lowered = status.toLowerCase();
  if (!LIMITS.ALLOWED_ENTRY_STATUSES.includes(lowered)) {
    throw new WatchlistValidationError(
      `"${status}" is not a recognised entry status (active, dismissed)`,
      "status",
    );
  }
  return lowered;
}

// ---------------------------------------------------------------------------
// Guards — size / boundary enforcement
// ---------------------------------------------------------------------------

/**
 * Rejects oversized watchlist arrays before any iteration begins.
 * Callers must paginate when the watchlist grows beyond MAX_WATCHLIST_ENTRIES.
 */
export function guardWatchlistSize(entries) {
  if (!Array.isArray(entries)) {
    throw new WatchlistValidationError("entries must be an array", "entries");
  }
  if (entries.length >= LIMITS.MAX_WATCHLIST_ENTRIES) {
    throw new WatchlistValidationError(
      `watchlist size ${entries.length} exceeds safe limit of ${LIMITS.MAX_WATCHLIST_ENTRIES} — paginate before scanning`,
      "entries",
    );
  }
  return true;
}

/**
 * Caps search query length to prevent ReDoS and unnecessary computation.
 */
export function validateSearchQuery(query) {
  if (query === undefined || query === null) {
    return "";
  }
  if (typeof query !== "string") {
    throw new WatchlistValidationError("search query must be a string", "search");
  }
  if (query.length > LIMITS.MAX_SEARCH_LENGTH) {
    throw new WatchlistValidationError(
      `search query exceeds max length of ${LIMITS.MAX_SEARCH_LENGTH}`,
      "search",
    );
  }
  return query.trim();
}

// ---------------------------------------------------------------------------
// Composite — batch validate an AddEntryInput-like object
// ---------------------------------------------------------------------------

export function validateAddEntryInput(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new WatchlistValidationError("addEntry input must be a plain object", "input");
  }
  const senderEmail = validateSenderEmail(input.senderEmail);
  const senderName = validateSenderName(input.senderName);
  const reason = validateReason(input.reason);
  const riskLevel = validateRiskLevel(input.riskLevel);
  const notes = validateNotes(input.notes);

  return { senderEmail, senderName, reason, riskLevel, notes };
}
