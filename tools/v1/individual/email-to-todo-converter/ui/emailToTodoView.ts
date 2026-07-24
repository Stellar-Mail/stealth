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

export interface EmailValidationResult {
  isValid: boolean;
  sanitizedEmail: NormalizedEmail | null;
  errors: string[];
  warnings: string[];
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

// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const HTML_TAG_PATTERN = /<[^>]*>/g;

function coerceString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function stripUnsafeText(value: string): string {
  return value.replace(CONTROL_CHARACTER_PATTERN, "").replace(HTML_TAG_PATTERN, " ");
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function normalizeWhitespace(value: string): string {
  return stripUnsafeText(value).replace(/\s+/g, " ").trim();
}

function sanitizeBodyForScan(body: string): string {
  return truncate(stripUnsafeText(body), MAX_BODY_CHARS_TO_SCAN);
}

function sanitizeLabels(labels: unknown): string[] {
  if (!Array.isArray(labels)) {
    return [];
  }
  return labels
    .slice(0, MAX_LABELS)
    .map((label) => truncate(normalizeWhitespace(coerceString(label)), MAX_LABEL_LENGTH))
    .filter((label) => label.length > 0);
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

export function validateAndSanitizeEmail(input: unknown): EmailValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!input || typeof input !== "object") {
    return {
      isValid: false,
      sanitizedEmail: null,
      errors: ["Email payload must be an object."],
      warnings,
    };
  }

  const candidate = input as Partial<NormalizedEmail>;
  const rawSubject = coerceString(candidate.subject);
  const rawSender = coerceString(candidate.sender);
  const rawReceivedAt = coerceString(candidate.receivedAt);
  const rawBody = coerceString(candidate.body);

  if (typeof candidate.subject !== "string") {
    warnings.push("Subject was missing or not text and was replaced with an empty subject.");
  }
  if (typeof candidate.sender !== "string") {
    warnings.push("Sender was missing or not text and was replaced with an empty sender.");
  }
  if (typeof candidate.body !== "string") {
    warnings.push("Body was missing or not text and was replaced with an empty body.");
  }
  if (rawBody.length > MAX_BODY_CHARS_TO_SCAN) {
    warnings.push("Body was truncated before scanning to avoid excessive work on large emails.");
  }
  if (rawSubject.length > MAX_SUBJECT_LENGTH) {
    warnings.push("Subject was truncated to the local display limit.");
  }
  if (rawSender.length > MAX_SENDER_LENGTH) {
    warnings.push("Sender was truncated to the local display limit.");
  }

  const sanitizedEmail: NormalizedEmail = {
    subject: truncate(normalizeWhitespace(rawSubject), MAX_SUBJECT_LENGTH),
    sender: truncate(normalizeWhitespace(rawSender), MAX_SENDER_LENGTH),
    receivedAt: rawReceivedAt,
    body: sanitizeBodyForScan(rawBody),
    labels: sanitizeLabels(candidate.labels),
  };

  if (!hasConvertibleContent(sanitizedEmail)) {
    errors.push("Email must include a subject or body to convert.");
  }
  if (rawReceivedAt.length > 0 && Number.isNaN(new Date(rawReceivedAt).getTime())) {
    errors.push("Received timestamp must be a parseable ISO-8601 value when provided.");
  }

  return {
    isValid: errors.length === 0,
    sanitizedEmail,
    errors,
    warnings,
  };
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
  const validation = validateAndSanitizeEmail(email);
  if (!validation.isValid || !validation.sanitizedEmail) {
    throw new Error(validation.errors.join(" ") || "Email payload is not convertible.");
  }
  const safeEmail = validation.sanitizedEmail;
  const priority = detectPriority(safeEmail);
  return {
    title: buildTaskTitle(safeEmail),
    notes: buildTaskNotes(safeEmail),
    sourceSubject: normalizeWhitespace(safeEmail.subject),
    sourceSender: normalizeWhitespace(safeEmail.sender),
    sourceReceivedAt: safeEmail.receivedAt,
    suggestedDueDate: suggestDueDate(safeEmail, priority),
    suggestedPriority: priority,
  };
}

export function hasConvertibleContent(email: NormalizedEmail | null): email is NormalizedEmail {
  if (!email) {
    return false;
  }
  return (
    normalizeWhitespace(coerceString(email.subject)).length > 0 ||
    normalizeWhitespace(coerceString(email.body)).length > 0
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
