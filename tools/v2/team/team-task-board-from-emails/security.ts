/**
 * security.ts — hardening helpers for the Team Task Board from Emails tool (#707).
 *
 * Adds explicit handling for malformed / hostile input and guards against
 * unnecessary work on large email histories, per the issue acceptance criteria.
 * This module is ADDITIVE: the existing `services/taskBoardService.ts` is not
 * modified; callers opt into the hardened path via `sanitizeEmail` /
 * `sanitizeTaskCard` / `validateEmailBatch` / `enforceBatchBounds`.
 *
 * Unsafe inputs addressed:
 *  - Oversized / control-byte-laden email subject, body, from, to[]
 *  - Hostile body driving the regex extraction loop (CPU amplification)
 *  - Out-of-range enums (priority, status) on derived task cards
 *  - Malformed `dueDate` (must be YYYY-MM-DD or null) and `receivedAt` (ISO)
 *  - Oversized `owner` / `notes` free text
 *  - Unbounded `emails` array that amplifies the per-email extraction loop
 */

import type { Email, TaskCard } from "./types";

/** Hard limits derived from threat assumptions (see docs/SECURITY.md). */
export const MAX_SUBJECT_CHARS = 500;
export const MAX_BODY_CHARS = 20_000;
export const MAX_FROM_CHARS = 256;
export const MAX_TO_RECIPIENTS = 50;
export const MAX_TITLE_CHARS = 500;
export const MAX_OWNER_CHARS = 100;
export const MAX_NOTES_CHARS = 2_000;
export const MAX_EMAILS = 2_000;
export const MAX_TASKS = 5_000;

const PRIORITIES = ["low", "medium", "high"];
const STATUSES = ["new", "triage", "blocked", "done"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Strip control characters (keep TAB/LF/CR) and collapse whitespace. */
function stripControlChars(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    const isControl = code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d;
    if (isControl) continue;
    out += ch;
  }
  return out.replace(/\s+/g, " ").trim();
}

function clamp(input: string, max: number): string {
  return input.length > max ? input.slice(0, max) : input;
}

/** True only for a real YYYY-MM-DD date (or null). */
export function isValidDueDate(value: string | null): boolean {
  if (value === null) return true;
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const t = Date.parse(value + "T00:00:00Z");
  return Number.isFinite(t);
}

/** True only for a parseable ISO date-time (or null). */
export function isValidISODateTime(value: string | null): boolean {
  if (value === null) return true;
  if (typeof value !== "string" || value.length === 0) return false;
  const t = Date.parse(value);
  return Number.isFinite(t);
}

export type SecurityIssue = { field: string; message: string };

/** Validate + sanitize a single email. Returns sanitized copy + issues. */
export function sanitizeEmail(email: Email): {
  value: Email;
  issues: SecurityIssue[];
} {
  const issues: SecurityIssue[] = [];
  if (!email || typeof email !== "object") {
    return { value: email, issues: [{ field: "email", message: "email is required" }] };
  }

  if (typeof email.id !== "string" || email.id.trim().length === 0) {
    issues.push({ field: "id", message: "id is required" });
  }
  if (typeof email.from !== "string" || email.from.trim().length === 0) {
    issues.push({ field: "from", message: "from is required" });
  }
  if (typeof email.subject !== "string") {
    issues.push({ field: "subject", message: "subject must be a string" });
  }
  if (typeof email.body !== "string") {
    issues.push({ field: "body", message: "body must be a string" });
  }
  if (!Array.isArray(email.to) || email.to.length > MAX_TO_RECIPIENTS) {
    issues.push({
      field: "to",
      message: `to must be an array with <= ${MAX_TO_RECIPIENTS} recipients`,
    });
  }
  if (!isValidISODateTime(email.receivedAt)) {
    issues.push({
      field: "receivedAt",
      message: "receivedAt must be a valid ISO date-time or null",
    });
  }

  return {
    value: {
      id: clamp(stripControlChars(email.id ?? ""), MAX_FROM_CHARS),
      threadId: clamp(stripControlChars(email.threadId ?? ""), MAX_FROM_CHARS),
      from: clamp(stripControlChars(email.from ?? ""), MAX_FROM_CHARS),
      to: Array.isArray(email.to)
        ? email.to
            .map((t) => clamp(stripControlChars(t ?? ""), MAX_FROM_CHARS))
            .slice(0, MAX_TO_RECIPIENTS)
        : [],
      subject: clamp(stripControlChars(email.subject ?? ""), MAX_SUBJECT_CHARS),
      // Body is capped hard so the regex extraction loop can't be amplified.
      body: clamp(stripControlChars(email.body ?? ""), MAX_BODY_CHARS),
      receivedAt: email.receivedAt,
      ...(email.signals ? { signals: email.signals.slice(0, 20) } : {}),
    },
    issues,
  };
}

/** Validate + sanitize a derived task card. Returns sanitized copy + issues. */
export function sanitizeTaskCard(card: TaskCard): {
  value: TaskCard;
  issues: SecurityIssue[];
} {
  const issues: SecurityIssue[] = [];
  if (!card || typeof card !== "object") {
    return { value: card, issues: [{ field: "card", message: "card is required" }] };
  }

  if (typeof card.id !== "string" || card.id.trim().length === 0) {
    issues.push({ field: "id", message: "id is required" });
  }
  if (typeof card.priority !== "string" || !PRIORITIES.includes(card.priority)) {
    issues.push({ field: "priority", message: "priority must be low|medium|high" });
  }
  if (typeof card.status !== "string" || !STATUSES.includes(card.status)) {
    issues.push({ field: "status", message: "status must be new|triage|blocked|done" });
  }
  if (!isValidDueDate(card.dueDate)) {
    issues.push({ field: "dueDate", message: "dueDate must be YYYY-MM-DD or null" });
  }
  if (typeof card.sourceEmailId !== "string" || card.sourceEmailId.trim().length === 0) {
    issues.push({ field: "sourceEmailId", message: "sourceEmailId is required" });
  }

  const value: TaskCard = {
    id: clamp(stripControlChars(card.id ?? ""), MAX_FROM_CHARS),
    title: clamp(stripControlChars(card.title ?? ""), MAX_TITLE_CHARS),
    owner: clamp(stripControlChars(card.owner ?? ""), MAX_OWNER_CHARS),
    dueDate: card.dueDate,
    priority: card.priority,
    status: card.status,
    sourceEmailId: clamp(stripControlChars(card.sourceEmailId ?? ""), MAX_FROM_CHARS),
    reviewRequired: Boolean(card.reviewRequired),
  };
  if (card.notes !== undefined) {
    value.notes = clamp(stripControlChars(card.notes), MAX_NOTES_CHARS);
  }
  return { value, issues };
}

/**
 * Validate a whole email batch. Callers must refuse to process when
 * `issues.length > 0`.
 */
export function validateEmailBatch(emails: Email[]): SecurityIssue[] {
  const issues: SecurityIssue[] = [];
  if (!Array.isArray(emails)) {
    return [{ field: "emails", message: "emails must be an array" }];
  }
  if (emails.length > MAX_EMAILS) {
    issues.push({ field: "emails", message: `too many emails (max ${MAX_EMAILS})` });
  }
  for (const email of emails) {
    const { issues: eIssues } = sanitizeEmail(email);
    for (const i of eIssues)
      issues.push({ field: `emails.${email?.id ?? "?"}:${i.field}`, message: i.message });
  }
  return issues;
}

/**
 * Performance guard: cap the email batch so the per-email regex extraction loop
 * cannot be amplified by an enormous history.
 */
export function enforceBatchBounds(emails: Email[]): Email[] {
  return emails.slice(0, MAX_EMAILS);
}
