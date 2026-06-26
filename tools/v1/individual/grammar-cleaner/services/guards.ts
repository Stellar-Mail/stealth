import { cleanGrammar, type GrammarInput, type GrammarResultStatus } from "./grammarCleaner";

export const GUARD_LIMITS = {
  maxSubjectChars: 200,
  maxBodyChars: 50000,
  maxBodyWords: 8000,
  maxAttachments: 0,
  maxTeamMembers: 1,
  maxHistoryItems: 0,
} as const;

export type GuardErrorCode = "input-too-large" | "unsupported-input" | "unsupported-dataset";

export interface GuardIssue {
  code: GuardErrorCode;
  message: string;
}

export type SafeGrammarResult =
  | GrammarResultStatus
  | { status: "error"; code: GuardErrorCode; message: string };

// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const INVISIBLE_CHARACTERS = /[\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g;

const DATASET_FIELDS = [
  "attachments",
  "teamMembers",
  "members",
  "messageHistory",
  "threadHistory",
  "history",
] as const;

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

function fieldLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function hasNonArrayDataset(input: Record<string, unknown>, fields: readonly string[]): boolean {
  return fields.some(
    (field) => field in input && input[field] !== undefined && !Array.isArray(input[field]),
  );
}

export function checkDatasetLimits(input: Record<string, unknown>): GuardIssue | null {
  if (hasNonArrayDataset(input, DATASET_FIELDS)) {
    return {
      code: "unsupported-dataset",
      message: "Dataset fields must be omitted or passed as arrays within Grammar Cleaner limits.",
    };
  }

  if (fieldLength(input.attachments) > GUARD_LIMITS.maxAttachments) {
    return {
      code: "unsupported-dataset",
      message: "Attachments are not accepted by the Grammar Cleaner.",
    };
  }

  const teamMemberCount = Math.max(fieldLength(input.teamMembers), fieldLength(input.members));
  if (teamMemberCount > GUARD_LIMITS.maxTeamMembers) {
    return {
      code: "unsupported-dataset",
      message: "Team member datasets are outside the individual Grammar Cleaner scope.",
    };
  }

  const historyCount = Math.max(
    fieldLength(input.messageHistory),
    fieldLength(input.threadHistory),
    fieldLength(input.history),
  );
  if (historyCount > GUARD_LIMITS.maxHistoryItems) {
    return {
      code: "unsupported-dataset",
      message: "Message history datasets are not processed by the Grammar Cleaner.",
    };
  }

  return null;
}

function hasDatasetFields(input: Record<string, unknown>): boolean {
  return DATASET_FIELDS.some((field) => field in input);
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
  if (typeof input !== "object" || input === null) {
    return {
      status: "error",
      code: "unsupported-input",
      message: "Expected input with a bodyText string field.",
    };
  }

  const candidate = input as Record<string, unknown>;
  if (hasDatasetFields(candidate)) {
    const datasetIssue = checkDatasetLimits(candidate);
    if (datasetIssue) {
      return { status: "error", code: datasetIssue.code, message: datasetIssue.message };
    }
  }

  if (!hasInspectableFields(input)) {
    return {
      status: "error",
      code: "unsupported-input",
      message: "Expected input with a bodyText string field.",
    };
  }

  const sanitized = sanitizeGrammarInput(input);
  const issue = checkInputLimits(sanitized);
  if (issue) {
    return { status: "error", code: issue.code, message: issue.message };
  }
  return cleanGrammar(sanitized);
}
