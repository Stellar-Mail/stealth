// Draft Improver — validation and sanitization layer.

import type {
  DraftImproverInput,
  DraftImproverOptions,
  DraftImproverValidationIssue,
  SafeDraftImproverResult,
} from "../types/draftImprover";

export const GUARD_LIMITS = {
  maxMessageIdChars: 256,
  maxSubjectChars: 500,
  maxBodyChars: 50000,
  maxBodyWords: 10000,
} as const;

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const INVISIBLE_CHARACTERS = /[\u200b-\u200d\u2060\ufeff]/g;

export function sanitizeText(text: string): string {
  return text
    .normalize("NFC")
    .replace(CONTROL_CHARACTERS, "")
    .replace(INVISIBLE_CHARACTERS, "")
    .trim();
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return 0;
  }
  return trimmed.split(/\s+/).length;
}

export function validateInput(value: unknown): value is DraftImproverInput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.messageId !== "string" || candidate.messageId.trim().length === 0) {
    return false;
  }
  if (typeof candidate.subject !== "string" || typeof candidate.body !== "string") {
    return false;
  }
  if (candidate.senderAddress !== undefined && typeof candidate.senderAddress !== "string") {
    return false;
  }
  if (candidate.receivedAt !== undefined && typeof candidate.receivedAt !== "string") {
    return false;
  }
  if (candidate.language !== undefined && typeof candidate.language !== "string") {
    return false;
  }
  return true;
}

export function validateOptions(value: unknown): value is DraftImproverOptions {
  if (value === undefined) {
    return true;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  if (candidate.includeSuggestions !== undefined && typeof candidate.includeSuggestions !== "boolean") {
    return false;
  }
  if (candidate.maxSuggestions !== undefined) {
    if (
      typeof candidate.maxSuggestions !== "number" ||
      !Number.isFinite(candidate.maxSuggestions) ||
      candidate.maxSuggestions < 1 ||
      candidate.maxSuggestions > 100
    ) {
      return false;
    }
  }
  return true;
}

export function checkInputLimits(input: DraftImproverInput): DraftImproverValidationIssue[] {
  const issues: DraftImproverValidationIssue[] = [];
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

export function sanitizeInput(input: DraftImproverInput): DraftImproverInput {
  return {
    ...input,
    messageId: input.messageId.trim(),
    subject: sanitizeText(input.subject),
    body: sanitizeText(input.body),
  };
}

export function safeImproveDraft(input: unknown, options?: unknown): SafeDraftImproverResult {
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
      message: "Options must use a boolean includeSuggestions and a maxSuggestions between 1 and 100.",
      issues: [{ code: "invalid-options", message: "Options failed structural validation." }],
    };
  }
  if (!isSupportedLanguage(input.language)) {
    return {
      status: "error",
      code: "unsupported-language",
      message: `Language "${input.language}" is not supported; only English is supported.`,
      issues: [{ code: "unsupported-language", field: "language", message: "Only English content can be analyzed." }],
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
  return { status: "ok", result: improveDraft(sanitized, options) };
}

export function improveDraft(
  input: DraftImproverInput,
  options: DraftImproverOptions = {},
): import("../types/draftImprover").DraftImproverResult {
  const subject = sanitizeText(input.subject).trim();
  const body = sanitizeText(input.body).trim();
  const normalizedSubject = subject.length > 0 ? subject : "Quick follow-up";
  const normalizedBody = body.length > 0 ? body : "Please find my update below.";

  const issues = [] as Array<import("../types/draftImprover").DraftImproverIssue>;
  const loweredBody = normalizedBody.toLowerCase();
  if (loweredBody.includes("will") || loweredBody.includes("very")) {
    issues.push({ type: "clarity", severity: "info", excerpt: normalizedBody.slice(0, 40), suggestion: "Replace vague wording with more precise language." });
  }
  if (normalizedBody.length > 160) {
    issues.push({ type: "conciseness", severity: "warn", excerpt: normalizedBody.slice(0, 40), suggestion: "Trim redundant phrasing to keep the note concise." });
  }
  if (normalizedSubject === normalizedSubject.toUpperCase() && normalizedSubject.length > 0) {
    issues.push({ type: "tone", severity: "info", excerpt: normalizedSubject, suggestion: "Use sentence case for a calmer tone." });
  }
  const sentences = normalizedBody.split(/(?<=[.!?])\s+/).filter(Boolean);
  const wordCount = normalizedBody.split(/\s+/).filter(Boolean).length;
  const readabilityScore = Math.max(0, Math.min(100, 100 - Math.max(0, wordCount - 20) * 2));

  const maxSuggestions = options.maxSuggestions ?? 5;
  const suggestions = issues.slice(0, maxSuggestions);
  const improvedBody = sentences.length > 1
    ? sentences.map((sentence, index) => `${index + 1}. ${sentence}`).join("\n")
    : normalizedBody;
  const improvedSubject = normalizedSubject.length > 0 ? normalizedSubject : "Quick follow-up";

  return {
    messageId: input.messageId,
    improvedSubject,
    improvedBody,
    score: readabilityScore,
    issues: options.includeSuggestions === false ? [] : suggestions,
    metrics: {
      wordCount,
      sentenceCount: sentences.length,
      readabilityScore,
    },
  };
}
