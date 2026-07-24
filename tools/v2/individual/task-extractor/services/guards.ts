// Task Extractor — validation, sanitization, and the safe entry point.
//
// Folder-local hardening layer that runs before the core engine to reject
// hostile or oversized input and to strip characters that could hide content
// or break downstream processing. Pure and deterministic: no network calls,
// no eval, and no mutation of caller-supplied objects.

import { extractTasks, MAX_TASKS_LIMIT } from "./taskExtractor";
import type {
  SafeTaskExtractionResult,
  TaskExtractionInput,
  TaskExtractionIssue,
  TaskExtractionOptions,
} from "../types/taskExtractor";

export const GUARD_LIMITS = {
  maxMessageIdChars: 256,
  maxSubjectChars: 500,
  maxBodyChars: 50000,
  maxBodyWords: 10000,
} as const;

// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const INVISIBLE_CHARACTERS = /[\u200b-\u200d\u2060\ufeff]/g;

const CONFIDENCE_LEVELS = ["low", "medium", "high"];

/** Normalize to NFC and strip control and zero-width characters. */
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

/** Structural type check — true when value is a usable TaskExtractionInput. */
export function validateInput(value: unknown): value is TaskExtractionInput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const v = value as Record<string, unknown>;
  if (typeof v.messageId !== "string" || v.messageId.trim().length === 0) {
    return false;
  }
  if (typeof v.subject !== "string" || typeof v.body !== "string") {
    return false;
  }
  if (v.senderAddress !== undefined && typeof v.senderAddress !== "string") {
    return false;
  }
  if (v.receivedAt !== undefined) {
    if (typeof v.receivedAt !== "string" || Number.isNaN(new Date(v.receivedAt).getTime())) {
      return false;
    }
  }
  if (v.language !== undefined && typeof v.language !== "string") {
    return false;
  }
  return true;
}

/** Structural type check for options. */
export function validateOptions(value: unknown): value is TaskExtractionOptions {
  if (value === undefined) {
    return true;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const v = value as Record<string, unknown>;
  if (v.maxTasks !== undefined) {
    if (
      typeof v.maxTasks !== "number" ||
      !Number.isFinite(v.maxTasks) ||
      v.maxTasks < 1 ||
      v.maxTasks > MAX_TASKS_LIMIT
    ) {
      return false;
    }
  }
  if (v.minConfidence !== undefined && !CONFIDENCE_LEVELS.includes(v.minConfidence as string)) {
    return false;
  }
  return true;
}

/** Size checks against GUARD_LIMITS. Empty array means within limits. */
export function checkInputLimits(input: TaskExtractionInput): TaskExtractionIssue[] {
  const issues: TaskExtractionIssue[] = [];
  if (input.messageId.length > GUARD_LIMITS.maxMessageIdChars) {
    issues.push({
      code: "input-too-large",
      field: "messageId",
      message: `messageId exceeds ${GUARD_LIMITS.maxMessageIdChars} characters`,
    });
  }
  if (input.subject.length > GUARD_LIMITS.maxSubjectChars) {
    issues.push({
      code: "input-too-large",
      field: "subject",
      message: `subject exceeds ${GUARD_LIMITS.maxSubjectChars} characters`,
    });
  }
  if (input.body.length > GUARD_LIMITS.maxBodyChars) {
    issues.push({
      code: "input-too-large",
      field: "body",
      message: `body exceeds ${GUARD_LIMITS.maxBodyChars} characters`,
    });
  } else if (countWords(input.body) > GUARD_LIMITS.maxBodyWords) {
    issues.push({
      code: "input-too-large",
      field: "body",
      message: `body exceeds ${GUARD_LIMITS.maxBodyWords} words`,
    });
  }
  return issues;
}

function isSupportedLanguage(language: string | undefined): boolean {
  if (language === undefined) {
    return true;
  }
  const normalized = language.toLowerCase();
  return normalized === "en" || normalized.startsWith("en-");
}

/** Return a sanitized copy of the input without mutating the original. */
export function sanitizeInput(input: TaskExtractionInput): TaskExtractionInput {
  return {
    ...input,
    messageId: input.messageId.trim(),
    subject: sanitizeText(input.subject),
    body: sanitizeText(input.body),
  };
}

/**
 * Guarded, non-throwing entry point for untrusted callers.
 *
 * Validates, sanitizes, and enforces limits before delegating to
 * extractTasks. Always returns a discriminated SafeTaskExtractionResult.
 */
export function safeExtractTasks(input: unknown, options?: unknown): SafeTaskExtractionResult {
  if (!validateInput(input)) {
    return {
      status: "error",
      code: "invalid-input",
      message: "Input must include a non-empty messageId and string subject and body.",
      issues: [{ code: "invalid-input", message: "Input failed structural validation." }],
    };
  }
  if (!validateOptions(options)) {
    return {
      status: "error",
      code: "invalid-options",
      message: `Options must use a maxTasks between 1 and ${MAX_TASKS_LIMIT} and a minConfidence of low, medium, or high.`,
      issues: [{ code: "invalid-options", message: "Options failed structural validation." }],
    };
  }
  if (!isSupportedLanguage(input.language)) {
    return {
      status: "error",
      code: "unsupported-language",
      message: `Language "${input.language}" is not supported; only English ("en") is available.`,
      issues: [
        {
          code: "unsupported-language",
          field: "language",
          message: "Only English content can be analyzed.",
        },
      ],
    };
  }
  const limitIssues = checkInputLimits(input);
  if (limitIssues.length > 0) {
    return {
      status: "error",
      code: "input-too-large",
      message: limitIssues.map((issue) => issue.message).join("; "),
      issues: limitIssues,
    };
  }
  const sanitized = sanitizeInput(input);
  if (sanitized.subject.trim().length === 0 && sanitized.body.trim().length === 0) {
    return {
      status: "error",
      code: "empty-content",
      message: "Subject and body are both empty after sanitization; nothing to analyze.",
      issues: [{ code: "empty-content", message: "No analyzable content present." }],
    };
  }
  return { status: "ok", result: extractTasks(sanitized, options) };
}
