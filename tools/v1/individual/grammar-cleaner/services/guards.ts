import { cleanGrammar, type GrammarInput, type GrammarResultStatus } from "./grammarCleaner";

export const GUARD_LIMITS = {
  maxSubjectChars: 200,
  maxBodyChars: 50000,
  maxBodyWords: 8000,
} as const;

export type GuardErrorCode = "input-too-large";

export interface GuardIssue {
  code: GuardErrorCode;
  message: string;
}

export type SafeGrammarResult =
  | GrammarResultStatus
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

function hasInspectableFields(value: unknown): value is GrammarInput {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return typeof candidate.bodyText === "string";
}

export function sanitizeGrammarInput(input: GrammarInput): GrammarInput {
  return {
    ...input,
    subject: input.subject ? sanitizeText(input.subject) : undefined,
    bodyText: sanitizeText(input.bodyText),
  };
}

export function checkInputLimits(input: GrammarInput): GuardIssue | null {
  if (input.subject && input.subject.length > GUARD_LIMITS.maxSubjectChars) {
    return {
      code: "input-too-large",
      message: "Subject exceeds " + GUARD_LIMITS.maxSubjectChars + " characters.",
    };
  }
  if (input.bodyText.length > GUARD_LIMITS.maxBodyChars) {
    return {
      code: "input-too-large",
      message: "Body exceeds " + GUARD_LIMITS.maxBodyChars + " characters.",
    };
  }
  if (countWords(input.bodyText) > GUARD_LIMITS.maxBodyWords) {
    return {
      code: "input-too-large",
      message: "Body exceeds " + GUARD_LIMITS.maxBodyWords + " words.",
    };
  }
  return null;
}

export function safeCleanGrammar(input: unknown): SafeGrammarResult {
  if (!hasInspectableFields(input)) {
    return cleanGrammar(input as GrammarInput);
  }
  const sanitized = sanitizeGrammarInput(input);
  const issue = checkInputLimits(sanitized);
  if (issue) {
    return { status: "error", code: issue.code, message: issue.message };
  }
  return cleanGrammar(sanitized);
}
