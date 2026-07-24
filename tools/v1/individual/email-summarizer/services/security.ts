/**
 * Email Summarizer — input hardening and performance guards.
 *
 * Folder-local safety layer for the Email Summarizer engine. These helpers
 * validate and sanitize untrusted email input before it reaches
 * summarizeEmail, and bound the work the pure engine performs so a hostile or
 * oversized payload can never cause unnecessary processing.
 *
 * Pure and deterministic: no network calls, no mailbox mutation, no external
 * providers, and no imports outside this tool folder. See docs/security.md for
 * the threat model and performance notes.
 */

import {
  summarizeEmail,
  type NormalizedEmail,
  type SummarizerOptions,
  type SummarizerResult,
} from "./emailSummarizer";

/** Conservative size caps that bound the work the engine performs. */
export const SECURITY_LIMITS = {
  /** Maximum accepted subject length, in characters. */
  maxSubjectLength: 1000,
  /** Maximum accepted sender length, in characters (RFC 5321 address ceiling). */
  maxSenderLength: 320,
  /** Maximum accepted receivedAt length, in characters. */
  maxReceivedAtLength: 64,
  /** Hard ceiling: bodies longer than this are rejected outright. */
  maxBodyLength: 100000,
  /** Soft ceiling: bodies longer than this are truncated before summarizing. */
  bodyTruncateLength: 20000,
} as const;

export type SecurityIssueField = "input" | "subject" | "sender" | "receivedAt" | "body";

export type SecurityIssueCode =
  | "not-an-object"
  | "missing-field"
  | "wrong-type"
  | "too-long"
  | "invalid-timestamp";

export interface SecurityIssue {
  field: SecurityIssueField;
  code: SecurityIssueCode;
  message: string;
}

export type EmailValidationResult =
  | { ok: true; value: NormalizedEmail; warnings: SecurityIssue[] }
  | { ok: false; issues: SecurityIssue[] };

// Control characters (except tab, newline, carriage return) can corrupt
// rendering or smuggle terminal escape sequences. They are replaced with a
// single space rather than dropped so word boundaries survive.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const HTML_TAG = /<[^>]*>/g;

/** Replaces dangerous control characters while preserving tab and newline. */
export function stripControlChars(text: string): string {
  return text.replace(CONTROL_CHARS, " ");
}

/** Removes HTML/markup tags so script or markup cannot ride along as text. */
export function stripHtml(text: string): string {
  return text.replace(HTML_TAG, "");
}

function sanitizeField(value: string, maxLength: number): string {
  const cleaned = stripControlChars(value).trim();
  return cleaned.length > maxLength ? cleaned.slice(0, maxLength) : cleaned;
}

const REQUIRED_FIELDS: Array<keyof NormalizedEmail> = ["subject", "sender", "receivedAt", "body"];

/**
 * Validates and sanitizes untrusted input into a NormalizedEmail.
 *
 * Malformed or hostile shapes (non-objects, missing fields, wrong types, or a
 * body past the hard ceiling) are rejected with typed issues. Recoverable
 * problems (control characters, oversized-but-bounded fields, an unparseable
 * timestamp) are sanitized and reported as non-fatal warnings.
 */
export function validateEmailInput(value: unknown): EmailValidationResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {
      ok: false,
      issues: [
        {
          field: "input",
          code: "not-an-object",
          message: "Email input must be an object with subject, sender, receivedAt, and body.",
        },
      ],
    };
  }

  const candidate = value as Record<string, unknown>;
  const issues: SecurityIssue[] = [];

  for (const field of REQUIRED_FIELDS) {
    if (!(field in candidate) || candidate[field] === undefined) {
      issues.push({
        field,
        code: "missing-field",
        message: `Missing required field "${field}".`,
      });
    } else if (typeof candidate[field] !== "string") {
      issues.push({
        field,
        code: "wrong-type",
        message: `Field "${field}" must be a string.`,
      });
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  const rawBody = candidate.body as string;
  if (rawBody.length > SECURITY_LIMITS.maxBodyLength) {
    return {
      ok: false,
      issues: [
        {
          field: "body",
          code: "too-long",
          message: `Email body exceeds the maximum of ${SECURITY_LIMITS.maxBodyLength} characters.`,
        },
      ],
    };
  }

  const warnings: SecurityIssue[] = [];

  const subject = sanitizeField(
    stripHtml(candidate.subject as string),
    SECURITY_LIMITS.maxSubjectLength,
  );
  const sender = sanitizeField(
    stripHtml(candidate.sender as string),
    SECURITY_LIMITS.maxSenderLength,
  );
  const receivedAt = sanitizeField(
    candidate.receivedAt as string,
    SECURITY_LIMITS.maxReceivedAtLength,
  );

  let body = stripControlChars(rawBody);
  if (body.length > SECURITY_LIMITS.bodyTruncateLength) {
    body = body.slice(0, SECURITY_LIMITS.bodyTruncateLength);
    warnings.push({
      field: "body",
      code: "too-long",
      message: `Email body truncated to ${SECURITY_LIMITS.bodyTruncateLength} characters before summarizing.`,
    });
  }

  if (Number.isNaN(new Date(receivedAt).getTime())) {
    warnings.push({
      field: "receivedAt",
      code: "invalid-timestamp",
      message: "receivedAt is not a valid date; preserved as-is for traceability.",
    });
  }

  return { ok: true, value: { subject, sender, receivedAt, body }, warnings };
}

/**
 * Hardened entry point: validates and sanitizes untrusted input, then delegates
 * to the pure summarizeEmail engine. Hostile or malformed input is reported as
 * a typed "unsupported-input" result instead of reaching the engine.
 */
export function summarizeEmailSafely(
  input: unknown,
  options: SummarizerOptions = {},
): SummarizerResult {
  const validation = validateEmailInput(input);
  if (!validation.ok) {
    return {
      status: "error",
      code: "unsupported-input",
      message: validation.issues.map((issue) => issue.message).join(" "),
    };
  }
  return summarizeEmail(validation.value, options);
}
