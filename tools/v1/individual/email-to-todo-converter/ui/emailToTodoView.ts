// Email-to-Todo Converter -- UI view-model and deterministic helpers.
//
// This module is intentionally self-contained and free of imports from the
// main inbox, routing, wallet, Stellar, database, or design-system layers, as
// required by the tool spec. Everything here is pure and deterministic so the
// UI layer can stay thin and testable without a DOM.

export type TaskPriority = "low" | "medium" | "high";

export type ConverterStatus = "empty" | "ready" | "loading" | "success" | "error";

export interface NormalizedEmail {
  subject: string;
  sender: string;
  receivedAt: string; // ISO-8601 timestamp
  body: string;
  labels?: string[];
}

export interface TaskDraft {
  title: string;
  notes: string;
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
export const MEDIUM_PRIORITY_KEYWORDS = ["soon", "today", "reminder", "follow up", "follow-up"];

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

export function detectPriority(email: NormalizedEmail): TaskPriority {
  const haystack = (email.subject + " " + email.body).toLowerCase();
  if (HIGH_PRIORITY_KEYWORDS.some((word) => haystack.includes(word))) {
    return "high";
  }
  if (MEDIUM_PRIORITY_KEYWORDS.some((word) => haystack.includes(word))) {
    return "medium";
  }
  return "low";
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
  const offset =
    priority === "high" ? HIGH_PRIORITY_DUE_DATE_OFFSET_DAYS : DEFAULT_DUE_DATE_OFFSET_DAYS;
  return addDays(email.receivedAt, offset);
}

export function buildTaskTitle(email: NormalizedEmail): string {
  const subject = normalizeWhitespace(email.subject);
  if (subject.length > 0) {
    return subject;
  }
  const fallback = normalizeWhitespace(firstNonEmptyLine(email.body));
  return fallback.length > 0 ? fallback : "Untitled task";
}

export function buildTaskNotes(email: NormalizedEmail): string {
  const summary = normalizeWhitespace(firstNonEmptyLine(email.body));
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
