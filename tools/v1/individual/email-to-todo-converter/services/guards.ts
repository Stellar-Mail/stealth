// Email-to-Todo Converter -- security and performance guards.
//
// Folder-local hardening layer that runs before the core engine to reject
// hostile or oversized input and to strip characters that could hide content
// or break downstream rendering. Everything here is pure and deterministic:
// no network calls, no mailbox access, no eval, and no mutation of
// caller-supplied objects.

import {
  buildTaskDraft,
  hasConvertibleContent,
  type NormalizedEmail,
  type TaskDraft,
} from "./emailToTodo";

export const GUARD_LIMITS = {
  maxSubjectChars: 180,
  maxBodyChars: 12000,
  maxBodyWords: 2500,
  maxSenderChars: 254,
  maxLabels: 20,
} as const;

export type GuardErrorCode = "input-too-large" | "invalid-input" | "not-convertible";

export interface GuardIssue {
  code: GuardErrorCode;
  message: string;
}

export type SafeBuildResult =
  | { status: "ok"; draft: TaskDraft; warnings: string[] }
  | { status: "error"; code: GuardErrorCode; message: string };

// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const HTML_TAG_PATTERN = /<[^>]*>/g;
// eslint-disable-next-line no-control-regex
const INVISIBLE_CHAR_PATTERN = /[\u200b-\u200d\u2060\ufeff]/g;

export function sanitizeText(value: string): string {
  return value
    .normalize("NFC")
    .replace(CONTROL_CHAR_PATTERN, "")
    .replace(INVISIBLE_CHAR_PATTERN, "")
    .replace(HTML_TAG_PATTERN, " ");
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return 0;
  }
  return trimmed.split(/\s+/).length;
}

export function validateEmailInput(value: unknown): value is NormalizedEmail {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const v = value as Record<string, unknown>;
  if (typeof v.subject !== "string") {
    return false;
  }
  if (typeof v.sender !== "string") {
    return false;
  }
  if (typeof v.receivedAt !== "string") {
    return false;
  }
  if (typeof v.body !== "string") {
    return false;
  }
  return true;
}

export function sanitizeEmailInput(input: NormalizedEmail): NormalizedEmail {
  return {
    subject: sanitizeText(input.subject),
    sender: sanitizeText(input.sender),
    receivedAt: input.receivedAt,
    body: sanitizeText(input.body),
    labels: input.labels
      ? input.labels
          .slice(0, GUARD_LIMITS.maxLabels)
          .map((l) => sanitizeText(l).replace(/\s+/g, " ").trim())
          .filter((l) => l.length > 0)
      : undefined,
  };
}

export function checkInputLimits(input: NormalizedEmail): GuardIssue | null {
  if (sanitizeText(input.subject).length > GUARD_LIMITS.maxSubjectChars) {
    return {
      code: "input-too-large",
      message: "Subject exceeds " + GUARD_LIMITS.maxSubjectChars + " characters.",
    };
  }
  if (sanitizeText(input.body).length > GUARD_LIMITS.maxBodyChars) {
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
  if (sanitizeText(input.sender).length > GUARD_LIMITS.maxSenderChars) {
    return {
      code: "input-too-large",
      message: "Sender exceeds " + GUARD_LIMITS.maxSenderChars + " characters.",
    };
  }
  return null;
}

export function safeBuildTaskDraft(input: unknown): SafeBuildResult {
  if (!validateEmailInput(input)) {
    return {
      status: "error",
      code: "invalid-input",
      message:
        "Invalid input: expected an object with string fields for subject, " +
        "sender, receivedAt, and body.",
    };
  }

  const sanitized = sanitizeEmailInput(input);

  if (!hasConvertibleContent(sanitized)) {
    return {
      status: "error",
      code: "not-convertible",
      message: "Email must include a subject or body to convert.",
    };
  }

  const limitIssue = checkInputLimits(sanitized);
  if (limitIssue) {
    return { status: "error", code: limitIssue.code, message: limitIssue.message };
  }

  const warnings: string[] = [];
  if (input.receivedAt.length > 0 && Number.isNaN(new Date(input.receivedAt).getTime())) {
    warnings.push("Received timestamp could not be parsed; due date will be approximate.");
  }

  return { status: "ok", draft: buildTaskDraft(sanitized), warnings };
}
