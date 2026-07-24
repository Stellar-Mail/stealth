/**
 * Email Tone Rewriter — security and performance guards.
 *
 * Folder-local hardening layer for the tone rewriter. These helpers run before
 * the core engine to reject hostile or oversized input and to strip characters
 * that could hide content or break downstream rendering. Everything here is
 * pure and deterministic: no network calls, no mailbox access, no eval, and no
 * mutation of caller-supplied objects.
 */

import { rewriteEmailTone, type RewriteRequest, type RewriterResult } from "./emailToneRewriter";

/**
 * Hard input bounds. They cap the work the engine can be asked to do and give
 * deterministic rejection for payloads that are too large to be a real draft.
 */
export const GUARD_LIMITS = {
  /** Max characters allowed in the subject line. */
  maxSubjectChars: 200,
  /** Max characters allowed in the body. */
  maxBodyChars: 20000,
  /** Max whitespace-separated words allowed in the body. */
  maxBodyWords: 4000,
  /** Upper bound accepted for the optional maxWords length constraint. */
  maxLengthConstraint: 2000,
} as const;

/** Guard-specific error codes, distinct from the engine validation codes. */
export type GuardErrorCode = "input-too-large" | "invalid-length-constraint";

export interface GuardIssue {
  code: GuardErrorCode;
  message: string;
}

/**
 * Result of the guarded entry point: either a normal engine result, or a guard
 * rejection raised before the engine runs any work.
 */
export type SafeRewriteResult =
  | RewriterResult
  | { status: "error"; code: GuardErrorCode; message: string };

// Control characters (except tab and newline) can hide or corrupt content.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
// Zero-width and BOM characters can smuggle invisible payloads into text.
const INVISIBLE_CHARACTERS = /[\u200b-\u200d\u2060\ufeff]/g;

/**
 * Normalizes text and strips control and invisible characters. Tabs and
 * newlines are preserved, then collapsed by the engine during rewriting.
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

/** True when the value has the string fields the guards need to inspect. */
function hasInspectableFields(value: unknown): value is RewriteRequest {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return typeof candidate.subject === "string" && typeof candidate.bodyText === "string";
}

/**
 * Returns a sanitized copy of the request without mutating the input. Only the
 * text fields are cleaned; tone and length constraints are passed through for
 * the engine to validate.
 */
export function sanitizeRewriteRequest(request: RewriteRequest): RewriteRequest {
  return {
    ...request,
    subject: sanitizeText(request.subject),
    bodyText: sanitizeText(request.bodyText),
  };
}

/**
 * Checks a sanitized request against the hard limits. Returns the first issue
 * found, or null when the request is within bounds.
 */
export function checkRequestLimits(request: RewriteRequest): GuardIssue | null {
  if (request.subject.length > GUARD_LIMITS.maxSubjectChars) {
    return {
      code: "input-too-large",
      message: "Subject exceeds " + GUARD_LIMITS.maxSubjectChars + " characters.",
    };
  }
  if (request.bodyText.length > GUARD_LIMITS.maxBodyChars) {
    return {
      code: "input-too-large",
      message: "Body exceeds " + GUARD_LIMITS.maxBodyChars + " characters.",
    };
  }
  if (countWords(request.bodyText) > GUARD_LIMITS.maxBodyWords) {
    return {
      code: "input-too-large",
      message: "Body exceeds " + GUARD_LIMITS.maxBodyWords + " words.",
    };
  }
  if (request.maxWords !== undefined) {
    const value = request.maxWords;
    if (!Number.isInteger(value) || value <= 0) {
      return {
        code: "invalid-length-constraint",
        message: "maxWords must be a positive integer.",
      };
    }
    if (value > GUARD_LIMITS.maxLengthConstraint) {
      return {
        code: "invalid-length-constraint",
        message: "maxWords must not exceed " + GUARD_LIMITS.maxLengthConstraint + ".",
      };
    }
  }
  return null;
}

/**
 * Guarded entry point. Sanitizes text, enforces hard limits, and only then
 * delegates to the core engine. Malformed shapes are passed straight to the
 * engine, which reports them through its own typed validation errors. The
 * engine never runs when a guard limit is exceeded, so hostile or oversized
 * payloads cannot trigger heavy rewriting work.
 */
export function safeRewriteEmailTone(input: unknown): SafeRewriteResult {
  if (!hasInspectableFields(input)) {
    return rewriteEmailTone(input as RewriteRequest);
  }
  const sanitized = sanitizeRewriteRequest(input);
  const issue = checkRequestLimits(sanitized);
  if (issue) {
    return { status: "error", code: issue.code, message: issue.message };
  }
  return rewriteEmailTone(sanitized);
}
