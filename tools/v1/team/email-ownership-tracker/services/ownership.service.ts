/**
 * Email Ownership Tracker — Core Service
 *
 * Pure business logic for validating and reading ownership history.
 * Isolation contract: this module must not import from the main app.
 */

export type OwnershipAction = "assigned" | "claimed" | "released" | "transferred";

export interface OwnershipEvent {
  id: string;
  threadId: string;
  ownerId: string;
  actorId: string;
  action: OwnershipAction;
  reason: string;
  note: string;
  createdAt: string;
}

export interface OwnershipEventInput {
  threadId: string;
  ownerId: string;
  actorId: string;
  action: OwnershipAction;
  reason?: string;
  note?: string;
  createdAt?: string;
}

export interface OwnershipValidationError {
  field: "threadId" | "ownerId" | "actorId" | "action" | "reason" | "note" | "createdAt";
  message: string;
}

export interface OwnershipSummary {
  threadId: string;
  currentOwnerId: string | null;
  eventCount: number;
  latestAction: OwnershipAction | null;
  latestAt: string | null;
}

export const MAX_REASON_LENGTH = 120;
export const MAX_NOTE_LENGTH = 500;
export const MAX_HISTORY_LIMIT = 200;

const VALID_ACTIONS: OwnershipAction[] = ["assigned", "claimed", "released", "transferred"];
const ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{1,79}$/;

export function now(): string {
  return new Date().toISOString();
}

export function normalizeIdentifier(value: string): string {
  return value.trim().toLowerCase();
}

export function sanitizeText(value: string, maxLength: number): string {
  return [...value]
    .map((char) => {
      const code = char.charCodeAt(0);
      return code < 32 || code === 127 ? " " : char;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function isValidIdentifier(value: string): boolean {
  return ID_PATTERN.test(normalizeIdentifier(value));
}

export function isValidIsoTimestamp(value: string): boolean {
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}

export function validateOwnershipEventInput(
  input: Partial<OwnershipEventInput>,
): OwnershipValidationError[] {
  const errors: OwnershipValidationError[] = [];

  if (!input.threadId || !isValidIdentifier(input.threadId)) {
    errors.push({
      field: "threadId",
      message: "Thread id must be 2-80 safe identifier characters.",
    });
  }

  if (!input.ownerId || !isValidIdentifier(input.ownerId)) {
    errors.push({
      field: "ownerId",
      message: "Owner id must be 2-80 safe identifier characters.",
    });
  }

  if (!input.actorId || !isValidIdentifier(input.actorId)) {
    errors.push({
      field: "actorId",
      message: "Actor id must be 2-80 safe identifier characters.",
    });
  }

  if (!input.action || !VALID_ACTIONS.includes(input.action)) {
    errors.push({ field: "action", message: "Action is not supported." });
  }

  if (input.reason && sanitizeText(input.reason, MAX_REASON_LENGTH).length === 0) {
    errors.push({ field: "reason", message: "Reason must contain visible text." });
  }

  if (input.note && sanitizeText(input.note, MAX_NOTE_LENGTH).length === 0) {
    errors.push({ field: "note", message: "Note must contain visible text." });
  }

  if (input.createdAt && !isValidIsoTimestamp(input.createdAt)) {
    errors.push({ field: "createdAt", message: "createdAt must be an ISO-8601 timestamp." });
  }

  return errors;
}

export function createOwnershipEvent(input: OwnershipEventInput): OwnershipEvent {
  const errors = validateOwnershipEventInput(input);
  if (errors.length > 0) {
    throw new Error(errors.map((error) => `${error.field}: ${error.message}`).join("; "));
  }

  const createdAt = input.createdAt ?? now();
  const threadId = normalizeIdentifier(input.threadId);
  const ownerId = normalizeIdentifier(input.ownerId);
  const actorId = normalizeIdentifier(input.actorId);

  return {
    id: `ownership_${threadId}_${createdAt}`,
    threadId,
    ownerId,
    actorId,
    action: input.action,
    reason: sanitizeText(input.reason ?? "", MAX_REASON_LENGTH),
    note: sanitizeText(input.note ?? "", MAX_NOTE_LENGTH),
    createdAt,
  };
}

export function appendOwnershipEvent(
  events: OwnershipEvent[],
  input: OwnershipEventInput,
): OwnershipEvent[] {
  return [...events, createOwnershipEvent(input)].sort(compareEventsAscending);
}

export function getOwnershipHistoryForThread(
  events: OwnershipEvent[],
  threadId: string,
  limit = MAX_HISTORY_LIMIT,
): OwnershipEvent[] {
  const normalizedThreadId = normalizeIdentifier(threadId);
  const safeLimit = Math.max(0, Math.min(Math.floor(limit), MAX_HISTORY_LIMIT));

  return events
    .filter((event) => event.threadId === normalizedThreadId)
    .sort(compareEventsDescending)
    .slice(0, safeLimit);
}

export function getCurrentOwnerId(events: OwnershipEvent[], threadId: string): string | null {
  const [latest] = getOwnershipHistoryForThread(events, threadId, 1);
  if (!latest || latest.action === "released") return null;
  return latest.ownerId;
}

export function summarizeOwnership(events: OwnershipEvent[], threadId: string): OwnershipSummary {
  const history = getOwnershipHistoryForThread(events, threadId);
  const [latest] = history;
  const normalizedThreadId = normalizeIdentifier(threadId);

  return {
    threadId: normalizedThreadId,
    currentOwnerId: getCurrentOwnerId(events, normalizedThreadId),
    eventCount: history.length,
    latestAction: latest?.action ?? null,
    latestAt: latest?.createdAt ?? null,
  };
}

function compareEventsAscending(a: OwnershipEvent, b: OwnershipEvent): number {
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

function compareEventsDescending(a: OwnershipEvent, b: OwnershipEvent): number {
  return compareEventsAscending(b, a);
}
