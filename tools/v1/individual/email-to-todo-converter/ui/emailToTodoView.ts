// Email-to-Todo Converter -- UI view-model and deterministic helpers.
//
// This module is intentionally self-contained and free of imports from the
// main inbox, routing, wallet, Stellar, database, or design-system layers, as
// required by the tool spec. Everything here is pure and deterministic so the
// UI layer can stay thin and testable without a DOM.

export type TaskPriority = "normal" | "high";

export type ConverterStatus = "empty" | "ready" | "loading" | "success" | "error";

export interface NormalizedEmail {
  id?: string;
  subject: string;
  sender: string;
  receivedAt: string; // ISO-8601 timestamp
  body: string;
  labels?: string[];
}

export interface TaskDraft {
  title: string;
  notes: string;
  sourceEmailId?: string;
  sourceSubject: string;
  sourceSender: string;
  sourceReceivedAt: string;
  suggestedDueDate: string; // ISO-8601 date (YYYY-MM-DD)
  suggestedPriority: TaskPriority;
}

export interface ConverterViewModel {
  statusMessage: string;
  isBusy: boolean;
  showEmptyState: boolean;
  showDraft: boolean;
  showError: boolean;
  canConvert: boolean;
}

export interface EmailToTodoConverterProps {
  email: NormalizedEmail | null;
  onSaveDraft?: (draft: TaskDraft) => void;
  idPrefix?: string;
}

export const HIGH_PRIORITY_KEYWORDS = ["urgent", "asap", "immediately", "critical"];
export const GENERIC_SUBJECT_KEYWORDS = [
  "update",
  "updates",
  "newsletter",
  "digest",
  "summary",
  "status",
  "reminder",
  "notes",
  "note",
  "fyi",
  "weekly",
  "daily",
  "report",
  "announcements",
];
export const ACTIONABLE_KEYWORDS = [
  "review",
  "follow up",
  "follow-up",
  "send",
  "reply",
  "respond",
  "confirm",
  "approve",
  "sign",
  "schedule",
  "call",
  "book",
  "prepare",
  "check",
  "share",
  "finish",
  "fix",
  "create",
  "draft",
  "submit",
  "pay",
  "coordinate",
  "meet",
];
const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export const DEFAULT_DUE_DATE_OFFSET_DAYS = 3;
export const HIGH_PRIORITY_DUE_DATE_OFFSET_DAYS = 1;
export const MAX_NOTES_LENGTH = 280;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function firstNonEmptyLine(body: string): string {
  const lines = body.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return "";
}

function normalizeTitleCase(value: string): string {
  if (value.length === 0) {
    return value;
  }
  return value[0].toUpperCase() + value.slice(1);
}

function stripDecorativePrefixes(value: string): string {
  return value
    .replace(/^(please|kindly)\s+/i, "")
    .replace(/^(could you|can you|would you)\s+/i, "")
    .replace(/^(please )?(could you|can you|would you)\s+/i, "")
    .replace(/^(we need to|need to)\s+/i, "")
    .replace(/^(action required|action needed|fyi|urgent|asap|critical|important)\s*[:,-]?\s*/i, "")
    .replace(/^(re|fw|fwd)\s*:\s*/i, "")
    .replace(/^the attached\s+/i, "")
    .replace(/^attached\s+/i, "");
}

function stripTrailingCoordinationClauses(value: string): string {
  return value
    .replace(/\s+\b(and let me know|and please|so that|so I can|so we can|because|while)\b.*$/i, "")
    .replace(
      /\s+\b(by|due|before)\s+(?:today|tomorrow|(?:mon|tues|wednes|thurs|fri|satur|sun)day|\d{4}-\d{2}-\d{2})\b.*$/i,
      "",
    )
    .replace(/\s+\b(today|tomorrow|tonight|now)\b\.?$/i, "")
    .replace(/\s+[,.!?;:]\s*$/, "")
    .trim();
}

function normalizeActionableText(value: string): string {
  const cleaned = stripTrailingCoordinationClauses(
    stripDecorativePrefixes(normalizeWhitespace(value)),
  );
  return cleaned.length > 0 ? normalizeTitleCase(cleaned) : "";
}

function isGenericSubject(subject: string): boolean {
  const normalized = normalizeWhitespace(subject).toLowerCase();
  if (normalized.length === 0) {
    return true;
  }
  if (/^(urgent|asap|critical|important)\b[:,-]?\s*/i.test(normalized)) {
    return true;
  }
  return GENERIC_SUBJECT_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function splitSentences(body: string): string[] {
  return body
    .replace(/\r\n/g, "\n")
    .split(/(?:[.!?]\s+|\n+)/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function findActionableSentence(body: string): string {
  const sentences = splitSentences(body);
  for (const sentence of sentences) {
    const normalized = sentence.toLowerCase();
    if (ACTIONABLE_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
      return sentence;
    }
  }
  return sentences[0] ?? "";
}

function parseExplicitDueDate(value: string, receivedAt: string): string {
  const normalized = normalizeWhitespace(value).toLowerCase();
  const isoMatch = normalized.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (isoMatch) {
    return isoMatch[1];
  }

  const weekdayMatch = normalized.match(
    /\b(?:by|due|before)\s+(today|tomorrow|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/,
  );
  const fallbackWeekdayMatch = normalized.match(
    /\b(today|tomorrow|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/,
  );
  const dueTarget = weekdayMatch?.[1] ?? fallbackWeekdayMatch?.[1];
  if (!dueTarget) {
    return "";
  }

  const baseDate = new Date(receivedAt);
  if (Number.isNaN(baseDate.getTime())) {
    return "";
  }

  if (dueTarget === "today") {
    return baseDate.toISOString().slice(0, 10);
  }

  if (dueTarget === "tomorrow") {
    baseDate.setUTCDate(baseDate.getUTCDate() + 1);
    return baseDate.toISOString().slice(0, 10);
  }

  const targetWeekday = WEEKDAY_INDEX[dueTarget];
  if (targetWeekday === undefined) {
    return "";
  }

  const currentWeekday = baseDate.getUTCDay();
  const daysUntilTarget = (targetWeekday - currentWeekday + 7) % 7 || 7;
  baseDate.setUTCDate(baseDate.getUTCDate() + daysUntilTarget);
  return baseDate.toISOString().slice(0, 10);
}

export function detectPriority(email: NormalizedEmail): TaskPriority {
  const haystack = (email.subject + " " + email.body).toLowerCase();
  if (HIGH_PRIORITY_KEYWORDS.some((word) => haystack.includes(word))) {
    return "high";
  }
  return "normal";
}

function addDays(isoTimestamp: string, days: number): string {
  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function suggestDueDate(email: NormalizedEmail, priority: TaskPriority): string {
  const explicitDueDate = parseExplicitDueDate(`${email.subject} ${email.body}`, email.receivedAt);
  if (explicitDueDate) {
    return explicitDueDate;
  }
  const offset =
    priority === "high" ? HIGH_PRIORITY_DUE_DATE_OFFSET_DAYS : DEFAULT_DUE_DATE_OFFSET_DAYS;
  return addDays(email.receivedAt, offset);
}

export function buildTaskTitle(email: NormalizedEmail): string {
  const subject = normalizeWhitespace(email.subject);
  const normalizedSubject = normalizeActionableText(subject);
  if (normalizedSubject.length > 0 && !isGenericSubject(subject)) {
    return normalizedSubject;
  }
  const actionableBody = normalizeActionableText(findActionableSentence(email.body));
  if (actionableBody.length > 0) {
    return actionableBody;
  }
  if (normalizedSubject.length > 0) {
    return normalizedSubject;
  }
  const fallback = normalizeWhitespace(firstNonEmptyLine(email.body));
  return fallback.length > 0 ? normalizeTitleCase(fallback) : "Untitled task";
}

export function buildTaskNotes(email: NormalizedEmail): string {
  const summary = normalizeWhitespace(email.body);
  if (summary.length <= MAX_NOTES_LENGTH) {
    return summary;
  }
  return summary.slice(0, MAX_NOTES_LENGTH - 1).trimEnd() + "...";
}

export function buildTaskDraft(email: NormalizedEmail): TaskDraft {
  const priority = detectPriority(email);
  return {
    title: buildTaskTitle(email),
    notes: buildTaskNotes(email),
    sourceEmailId: email.id,
    sourceSubject: normalizeWhitespace(email.subject),
    sourceSender: normalizeWhitespace(email.sender),
    sourceReceivedAt: email.receivedAt,
    suggestedDueDate: suggestDueDate(email, priority),
    suggestedPriority: priority,
  };
}

export function hasConvertibleContent(email: NormalizedEmail | null): email is NormalizedEmail {
  if (!email) {
    return false;
  }
  return (
    normalizeWhitespace(email.subject).length > 0 || normalizeWhitespace(email.body).length > 0
  );
}

export function resolveStatusMessage(status: ConverterStatus): string {
  switch (status) {
    case "empty":
      return "No email selected. Choose an email to convert into a task draft.";
    case "ready":
      return "Ready to convert the selected email into a task draft.";
    case "loading":
      return "Converting email into a task draft...";
    case "success":
      return "Task draft ready for review. Nothing has been saved yet.";
    case "error":
      return "The selected email could not be converted into a task draft.";
    default:
      return "";
  }
}

export function describeConverter(args: {
  status: ConverterStatus;
  hasEmail: boolean;
}): ConverterViewModel {
  const { status, hasEmail } = args;
  return {
    statusMessage: resolveStatusMessage(status),
    isBusy: status === "loading",
    showEmptyState: status === "empty" || !hasEmail,
    showDraft: status === "success",
    showError: status === "error",
    canConvert: hasEmail && status !== "loading",
  };
}
