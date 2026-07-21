// Follow-up Sequence Builder — security and performance guards.
//
// Folder-local hardening layer that runs before the core engine to reject
// hostile or oversized input and to strip characters that could hide content
// or break downstream rendering. Pure and deterministic: no network calls, no
// mailbox access, no eval, and no mutation of caller-supplied objects.

import {
  buildSequence,
  type ExistingSequenceKey,
  type FollowUpSequence,
  type SequenceBuildInput,
  type SequenceBuildOptions,
} from "./followUpSequenceBuilder";

export const GUARD_LIMITS = {
  maxSubjectChars: 500,
  maxBodyChars: 50000,
  maxBodyWords: 10000,
  maxExistingSequences: 500,
  maxSteps: 10,
} as const;

export type GuardErrorCode = "input-too-large" | "invalid-input" | "too-many-existing-sequences";

export interface GuardIssue {
  code: GuardErrorCode;
  message: string;
}

export type SafeBuildResult =
  | { status: "ok"; sequence: FollowUpSequence }
  | { status: "error"; code: GuardErrorCode; message: string };

// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const INVISIBLE_CHARACTERS = /[\u200b-\u200d\u2060\ufeff]/g;

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

export function validateInput(value: unknown): value is SequenceBuildInput {
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

export function sanitizeInput(input: SequenceBuildInput): SequenceBuildInput {
  return {
    ...input,
    subject: sanitizeText(input.subject),
    body: sanitizeText(input.body),
    senderName: input.senderName ? sanitizeText(input.senderName) : undefined,
    threadHint: input.threadHint ? sanitizeText(input.threadHint) : undefined,
  };
}

export function checkInputLimits(input: SequenceBuildInput): GuardIssue | null {
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

export function validateOptions(value: unknown): SequenceBuildOptions {
  if (typeof value !== "object" || value === null) {
    return {};
  }
  const raw = value as Record<string, unknown>;
  const result: SequenceBuildOptions = {};
  if (typeof raw.now === "string") {
    result.now = raw.now;
  }
  if (typeof raw.maxSteps === "number" && raw.maxSteps > 0) {
    result.maxSteps = Math.min(raw.maxSteps, GUARD_LIMITS.maxSteps);
  }
  if (Array.isArray(raw.existingSequences)) {
    const items = raw.existingSequences.slice(0, GUARD_LIMITS.maxExistingSequences);
    result.existingSequences = items.filter((item: unknown): item is ExistingSequenceKey => {
      if (typeof item !== "object" || item === null) return false;
      const e = item as Record<string, unknown>;
      return typeof e.sourceMessageId === "string" && typeof e.title === "string";
    });
  }
  return result;
}

export function checkOptionsLimits(options: SequenceBuildOptions): GuardIssue | null {
  if (
    options.existingSequences &&
    options.existingSequences.length > GUARD_LIMITS.maxExistingSequences
  ) {
    return {
      code: "too-many-existing-sequences",
      message: "Existing sequences list exceeds " + GUARD_LIMITS.maxExistingSequences + " entries.",
    };
  }
  return null;
}

export function safeBuildSequence(input: unknown, options?: unknown): SafeBuildResult {
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

  return { status: "ok", sequence: buildSequence(sanitized, parsedOptions) };
}
