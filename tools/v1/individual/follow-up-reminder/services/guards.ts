// Follow-up Reminder — security and performance guards.
//
// Folder-local hardening layer that runs before the core engine to reject
// hostile or oversized input and to strip characters that could hide content
// or break downstream rendering. Everything here is pure and deterministic:
// no network calls, no mailbox access, no eval, and no mutation of
// caller-supplied objects.

import {
  buildFollowUpReminder,
  type BuildReminderOptions,
  type ExistingReminderKey,
  type NormalizedEmailInput,
  type ReminderReviewModel,
} from "./followUpReminder";

/**
 * Hard input bounds. They cap the work the engine can be asked to do and give
 * deterministic rejection for payloads that are too large to be a real email.
 */
export const GUARD_LIMITS = {
  /** Max characters allowed in the subject line. */
  maxSubjectChars: 500,
  /** Max characters allowed in the email body. */
  maxBodyChars: 50000,
  /** Max whitespace-separated words allowed in the body. */
  maxBodyWords: 10000,
  /** Max existing reminder entries accepted for dedup checks. */
  maxExistingReminders: 1000,
} as const;

/** Guard-specific error codes, distinct from engine-level warnings. */
export type GuardErrorCode = "input-too-large" | "invalid-input" | "too-many-existing-reminders";

export interface GuardIssue {
  code: GuardErrorCode;
  message: string;
}

/**
 * Result of the guarded entry point: either a normal engine result wrapped in
 * success, or a guard rejection raised before the engine runs any work.
 */
export type SafeBuildResult =
  | { status: "ok"; model: ReminderReviewModel }
  | { status: "error"; code: GuardErrorCode; message: string };

// Control characters (except tab and newline) can hide or corrupt content.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
// Zero-width and BOM characters can smuggle invisible payloads into text.
const INVISIBLE_CHARACTERS = /[\u200b-\u200d\u2060\ufeff]/g;

/**
 * Normalizes text and strips control and invisible characters. Tabs and
 * newlines are preserved, then collapsed by the engine during scanning.
 */
export function sanitizeText(text: string): string {
  return text.normalize("NFC").replace(CONTROL_CHARACTERS, "").replace(INVISIBLE_CHARACTERS, "");
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return 0;
  }
  return trimmed.split(/\s+/).length;
}

/**
 * True when the value has the string fields the guards need to inspect and
 * the required fields for the engine to produce a meaningful result.
 */
function hasInspectableFields(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.subject === "string" &&
    typeof candidate.body === "string" &&
    typeof candidate.senderAddress === "string" &&
    typeof candidate.receivedAt === "string"
  );
}

/**
 * Validates that the input has a valid shape for the engine. Checks for the
 * presence and types of required fields, and validates the receivedAt format.
 */
export function validateInput(value: unknown): value is NormalizedEmailInput {
  if (!hasInspectableFields(value)) {
    return false;
  }
  const v = value as Record<string, unknown>;
  if (typeof v.messageId !== "string" || v.messageId.length === 0) {
    return false;
  }
  if (Number.isNaN(new Date(String(v.receivedAt)).getTime())) {
    return false;
  }
  if (v.senderName !== undefined && typeof v.senderName !== "string") {
    return false;
  }
  if (v.timeZone !== undefined && typeof v.timeZone !== "string") {
    return false;
  }
  if (v.threadHint !== undefined && typeof v.threadHint !== "string") {
    return false;
  }
  return true;
}

/**
 * Returns a sanitized copy of the input without mutating the original. Only
 * text fields that could contain hidden characters are cleaned; other fields
 * are passed through unchanged.
 */
export function sanitizeInput(input: NormalizedEmailInput): NormalizedEmailInput {
  return {
    ...input,
    subject: sanitizeText(input.subject),
    body: sanitizeText(input.body),
    senderName: input.senderName ? sanitizeText(input.senderName) : undefined,
    threadHint: input.threadHint ? sanitizeText(input.threadHint) : undefined,
  };
}

/**
 * Checks a validated, sanitized input against the hard size limits. Returns
 * the first issue found, or null when the input is within bounds.
 */
export function checkInputLimits(input: NormalizedEmailInput): GuardIssue | null {
  if (input.subject.length > GUARD_LIMITS.maxSubjectChars) {
    return {
      code: "input-too-large",
      message: "Subject exceeds " + GUARD_LIMITS.maxSubjectChars + " characters.",
    };
  }
  if (input.body.length > GUARD_LIMITS.maxBodyChars) {
    return {
      code: "input-too-large",
      message: "Body exceeds " + GUARD_LIMITS.maxBodyChars + " characters.",
    };
  }
  if (countWords(input.body) > GUARD_LIMITS.maxBodyWords) {
    return {
      code: "input-too-large",
      message: "Body exceeds " + GUARD_LIMITS.maxBodyWords + " words.",
    };
  }
  return null;
}

/**
 * Validates the optional options parameter and extracts the fields the engine
 * needs. Silently clamps oversized arrays to the hard cap.
 */
export function validateOptions(value: unknown): BuildReminderOptions {
  if (typeof value !== "object" || value === null) {
    return {};
  }
  const raw = value as Record<string, unknown>;
  const result: BuildReminderOptions = {};
  if (typeof raw.now === "string") {
    result.now = raw.now;
  }
  if (Array.isArray(raw.existingReminders)) {
    const items = raw.existingReminders.slice(0, GUARD_LIMITS.maxExistingReminders);
    result.existingReminders = items.filter((item: unknown): item is ExistingReminderKey => {
      if (typeof item !== "object" || item === null) return false;
      const e = item as Record<string, unknown>;
      return (
        typeof e.sourceMessageId === "string" && (e.dueAt === null || typeof e.dueAt === "string")
      );
    });
  }
  return result;
}

/**
 * Checks parsed options for guard-level issues. Currently validates that the
 * existingReminders array does not exceed the hard cap.
 */
export function checkOptionsLimits(options: BuildReminderOptions): GuardIssue | null {
  if (
    options.existingReminders &&
    options.existingReminders.length > GUARD_LIMITS.maxExistingReminders
  ) {
    return {
      code: "too-many-existing-reminders",
      message: "Existing reminders list exceeds " + GUARD_LIMITS.maxExistingReminders + " entries.",
    };
  }
  return null;
}

/**
 * Guarded entry point. Validates input shape, sanitizes text fields, enforces
 * hard size limits, checks options bounds, and only then delegates to the core
 * engine. Malformed inputs are rejected before the engine runs any work, so
 * hostile or oversized payloads cannot trigger unbounded scanning.
 */
export function safeBuildFollowUpReminder(input: unknown, options?: unknown): SafeBuildResult {
  if (!validateInput(input)) {
    return {
      status: "error",
      code: "invalid-input",
      message:
        "Invalid input: expected an object with string fields for subject, " +
        "body, senderAddress, receivedAt, and a non-empty messageId.",
    };
  }

  const sanitized = sanitizeInput(input);

  const limitIssue = checkInputLimits(sanitized);
  if (limitIssue) {
    return { status: "error", code: limitIssue.code, message: limitIssue.message };
  }

  const parsedOptions = validateOptions(options);

  return { status: "ok", model: buildFollowUpReminder(sanitized, parsedOptions) };
}
