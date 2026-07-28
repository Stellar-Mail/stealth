// Email-to-Todo Converter -- core feature engine.
//
// Self-contained and deterministic. No imports from the main inbox, routing,
// wallet, Stellar, database, or design-system layers, as required by the tool
// spec. The engine performs no IO: it never sends email, touches the mailbox,
// creates calendar events, or calls external services. It only turns a
// normalized email into a single task draft.

export type TaskPriority = "low" | "medium" | "high";

export interface NormalizedEmail {
  subject: string;
  sender: string;
  receivedAt: string;
  body: string;
  labels?: string[];
}

export interface TaskDraft {
  title: string;
  notes: string;
  sourceSubject: string;
  sourceSender: string;
  sourceReceivedAt: string;
  suggestedDueDate: string;
  suggestedPriority: TaskPriority;
}

export const HIGH_PRIORITY_KEYWORDS = ["urgent", "asap", "immediately", "critical"];
export const MEDIUM_PRIORITY_KEYWORDS = ["soon", "today", "reminder", "follow up", "follow-up"];

export const DEFAULT_DUE_DATE_OFFSET_DAYS = 3;
export const HIGH_PRIORITY_DUE_DATE_OFFSET_DAYS = 1;
export const MAX_NOTES_LENGTH = 280;
export const MAX_SUBJECT_LENGTH = 180;
export const MAX_SENDER_LENGTH = 254;
export const MAX_BODY_CHARS_TO_SCAN = 12_000;
export const MAX_LABELS = 20;
export const MAX_LABEL_LENGTH = 40;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function sanitizeBodyForScan(body: string): string {
  return body.slice(0, MAX_BODY_CHARS_TO_SCAN);
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function firstNonEmptyLine(body: string): string {
  const boundedBody = sanitizeBodyForScan(body);
  const lines = boundedBody.split("\n");
  for (const line of lines) {
    const trimmed = normalizeWhitespace(line);
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return "";
}

export function detectPriority(email: NormalizedEmail): TaskPriority {
  const haystack = (email.subject + " " + sanitizeBodyForScan(email.body)).toLowerCase();
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
  const subject = truncate(normalizeWhitespace(email.subject), MAX_SUBJECT_LENGTH);
  if (subject.length > 0) {
    return subject;
  }
  const fallback = firstNonEmptyLine(email.body);
  return fallback.length > 0 ? truncate(fallback, MAX_SUBJECT_LENGTH) : "Untitled task";
}

export function buildTaskNotes(email: NormalizedEmail): string {
  const summary = firstNonEmptyLine(email.body);
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
