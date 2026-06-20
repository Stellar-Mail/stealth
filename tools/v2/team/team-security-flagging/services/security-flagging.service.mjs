/**
 * Team Security Flagging - Core Service
 * Pure functions for security incident detection, classification, and flag management.
 * No external dependencies — safe to test in isolation with node:test.
 */

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class SecurityFlagError extends Error {
  /** @param {string} message @param {string|null} [field] */
  constructor(message, field) {
    super(message);
    this.name = "SecurityFlagError";
    this.field = field ?? null;
  }
}

// ---------------------------------------------------------------------------
// Limits / constants
// ---------------------------------------------------------------------------

export const LIMITS = Object.freeze({
  MAX_DESCRIPTION_LENGTH: 2000,
  MAX_EVIDENCE_ITEMS: 10,
  MAX_EVIDENCE_LENGTH: 500,
  MAX_EMAIL_LENGTH: 254,
  MAX_THREAD_ID_LENGTH: 100,
  MAX_EMAIL_ID_LENGTH: 100,
  ALLOWED_SEVERITIES: /** @type {const} */ (["critical", "high", "medium", "low"]),
  ALLOWED_CATEGORIES: /** @type {const} */ ([
    "phishing",
    "credential-theft",
    "malware",
    "data-breach",
    "suspicious-sender",
    "unauthorized-access",
    "social-engineering",
    "other",
  ]),
  ALLOWED_STATUSES: /** @type {const} */ ([
    "new",
    "under-review",
    "escalated",
    "resolved",
    "dismissed",
  ]),
});

// ---------------------------------------------------------------------------
// Sanitizers
// ---------------------------------------------------------------------------

/** Strip control characters and trim. Returns null for non-strings. */
export function sanitizeText(value) {
  if (typeof value !== "string") return null;
  // eslint-disable-next-line no-control-regex
  return value.trim().replace(/[\x00-\x1F\x7F]/g, "");
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

export function validateSeverity(value) {
  const s = sanitizeText(value);
  if (!s) throw new SecurityFlagError("severity is required", "severity");
  if (!LIMITS.ALLOWED_SEVERITIES.includes(s)) {
    throw new SecurityFlagError(`Unknown severity: "${s}"`, "severity");
  }
  return s;
}

export function validateCategory(value) {
  const s = sanitizeText(value);
  if (!s) throw new SecurityFlagError("category is required", "category");
  if (!LIMITS.ALLOWED_CATEGORIES.includes(s)) {
    throw new SecurityFlagError(`Unknown category: "${s}"`, "category");
  }
  return s;
}

export function validateStatus(value) {
  const s = sanitizeText(value);
  if (!s) throw new SecurityFlagError("status is required", "status");
  if (!LIMITS.ALLOWED_STATUSES.includes(s)) {
    throw new SecurityFlagError(`Unknown status: "${s}"`, "status");
  }
  return s;
}

/** Guards against CRLF injection, null bytes, and basic structural validity. */
export function validateEmail(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new SecurityFlagError("email is required", "email");
  }
  if (/[\r\n\x00]/.test(value)) {
    throw new SecurityFlagError("email contains illegal characters", "email");
  }
  if (value.length > LIMITS.MAX_EMAIL_LENGTH) {
    throw new SecurityFlagError(`email exceeds ${LIMITS.MAX_EMAIL_LENGTH} characters`, "email");
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
    throw new SecurityFlagError("email format is invalid", "email");
  }
  return value.trim();
}

/** Guards against path traversal, spaces, and XSS in IDs. */
export function validateThreadId(value) {
  const s = sanitizeText(value);
  if (!s) throw new SecurityFlagError("threadId is required", "threadId");
  if (s.length > LIMITS.MAX_THREAD_ID_LENGTH) {
    throw new SecurityFlagError(
      `threadId exceeds ${LIMITS.MAX_THREAD_ID_LENGTH} characters`,
      "threadId",
    );
  }
  if (!/^[\w-]+$/.test(s)) {
    throw new SecurityFlagError("threadId contains invalid characters", "threadId");
  }
  return s;
}

export function validateEmailId(value) {
  const s = sanitizeText(value);
  if (!s) throw new SecurityFlagError("emailId is required", "emailId");
  if (s.length > LIMITS.MAX_EMAIL_ID_LENGTH) {
    throw new SecurityFlagError(
      `emailId exceeds ${LIMITS.MAX_EMAIL_ID_LENGTH} characters`,
      "emailId",
    );
  }
  if (!/^[\w-]+$/.test(s)) {
    throw new SecurityFlagError("emailId contains invalid characters", "emailId");
  }
  return s;
}

export function validateDescription(value) {
  const s = sanitizeText(value);
  if (!s) throw new SecurityFlagError("description is required", "description");
  if (s.length > LIMITS.MAX_DESCRIPTION_LENGTH) {
    throw new SecurityFlagError(
      `description exceeds ${LIMITS.MAX_DESCRIPTION_LENGTH} characters`,
      "description",
    );
  }
  return s;
}

export function validateEvidence(items) {
  if (!Array.isArray(items)) {
    throw new SecurityFlagError("evidence must be an array", "evidence");
  }
  if (items.length > LIMITS.MAX_EVIDENCE_ITEMS) {
    throw new SecurityFlagError(
      `evidence must not exceed ${LIMITS.MAX_EVIDENCE_ITEMS} items`,
      "evidence",
    );
  }
  return items.map((item, i) => {
    const s = sanitizeText(item);
    if (!s) throw new SecurityFlagError(`evidence[${i}] is empty`, "evidence");
    if (s.length > LIMITS.MAX_EVIDENCE_LENGTH) {
      throw new SecurityFlagError(
        `evidence[${i}] exceeds ${LIMITS.MAX_EVIDENCE_LENGTH} characters`,
        "evidence",
      );
    }
    return s;
  });
}

export function validateCreateFlagInput(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new SecurityFlagError("input must be a plain object");
  }
  validateEmailId(input.emailId);
  validateThreadId(input.threadId);
  validateEmail(input.reportedBy);
  validateEmail(input.senderEmail);
  validateSeverity(input.severity);
  validateCategory(input.category);
  validateDescription(input.description);
  if (input.evidence !== undefined) validateEvidence(input.evidence);
  return true;
}

// ---------------------------------------------------------------------------
// Auto-classification
// ---------------------------------------------------------------------------

const SIGNAL_MAP = {
  phishing: [
    "click here",
    "verify your account",
    "your password has expired",
    "unusual sign-in",
    "suspended account",
    "confirm your credentials",
    "urgent action required",
    "limited time",
    "act now",
    "security alert",
  ],
  "credential-theft": [
    "enter your password",
    "reset your password",
    "sign in to confirm",
    "two-factor",
    "authentication code",
    "verify your identity",
    "one-time code",
  ],
  malware: [
    "open the attachment",
    "download the file",
    "enable macros",
    "run the installer",
    "invoice attached",
    "payment receipt attached",
    "view the document",
  ],
  "social-engineering": [
    "wire transfer",
    "gift card",
    "keep this confidential",
    "do not share",
    "ceo request",
    "executive request",
    "urgent request from",
    "do not reply to this email",
  ],
  "data-breach": [
    "unauthorized access",
    "your data was exposed",
    "breach notification",
    "data leak",
    "account compromised",
    "security incident",
  ],
  "suspicious-sender": ["noreply@", "do-not-reply@", "mailer-daemon", "postmaster@"],
};

function matchSignals(text, signals) {
  const lower = text.toLowerCase();
  return signals.filter((s) => lower.includes(s));
}

/**
 * Classify an email signal into a severity + category + confidence.
 * @param {{ subject: string, snippet: string, bodyPreview: string, senderEmail: string }} signal
 * @returns {{ severity: string, category: string, confidence: string, matchedSignals: string[] }}
 */
export function classifyEmail(signal) {
  const combined =
    `${signal.subject} ${signal.snippet} ${signal.bodyPreview} ${signal.senderEmail}`.toLowerCase();

  const matches = {};
  let totalMatched = 0;

  for (const [category, signals] of Object.entries(SIGNAL_MAP)) {
    const found = matchSignals(combined, signals);
    matches[category] = found;
    totalMatched += found.length;
  }

  // Pick the category with the most matched signals; default to "other"
  let topCategory = "other";
  let topCount = 0;
  for (const [category, found] of Object.entries(matches)) {
    if (found.length > topCount) {
      topCount = found.length;
      topCategory = category;
    }
  }

  const allMatched = Object.values(matches).flat();

  let severity = "low";
  if (totalMatched >= 4 || (matches.phishing ?? []).length >= 3) severity = "critical";
  else if (totalMatched >= 2) severity = "high";
  else if (totalMatched === 1) severity = "medium";

  let confidence = "low";
  if (totalMatched >= 3) confidence = "high";
  else if (totalMatched >= 1) confidence = "medium";

  return { severity, category: topCategory, confidence, matchedSignals: allMatched };
}

// ---------------------------------------------------------------------------
// Status-transition guard
// ---------------------------------------------------------------------------

/** Allowed next statuses for each status. Terminal statuses have empty arrays. */
const VALID_TRANSITIONS = {
  new: ["under-review", "dismissed"],
  "under-review": ["escalated", "resolved", "dismissed"],
  escalated: ["resolved", "dismissed"],
  resolved: [],
  dismissed: [],
};

export function canTransition(from, to) {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

export function validateStatusTransition(from, to) {
  validateStatus(from);
  validateStatus(to);
  if (!canTransition(from, to)) {
    throw new SecurityFlagError(`Cannot transition from "${from}" to "${to}"`, "status");
  }
  return true;
}

// ---------------------------------------------------------------------------
// Severity comparison utilities
// ---------------------------------------------------------------------------

const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1 };

/** Returns true if a is strictly more severe than b. */
export function isMoreSevere(a, b) {
  return (SEVERITY_RANK[a] ?? 0) > (SEVERITY_RANK[b] ?? 0);
}

/** Returns the higher severity of the two. */
export function maxSeverity(a, b) {
  return isMoreSevere(a, b) ? a : b;
}
