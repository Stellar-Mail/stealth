import {
  CATEGORIES,
  FlagRecord,
  ISOString,
  SEVERITIES,
  STATUSES,
  type Category,
  type Severity,
  type Status,
} from "./flag";

export class FlagValidationError extends Error {
  code = "FLAG_VALIDATION_ERROR";
  constructor(message: string) {
    super(message);
    this.name = "FlagValidationError";
  }
}

export function isISODate(value: string): boolean {
  // Fast ISO-ish check; we also validate through Date parsing.
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T/.test(value)) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

export function assertValidSeverity(severity: string): asserts severity is Severity {
  if (!(SEVERITIES as readonly string[]).includes(severity)) {
    throw new FlagValidationError(`Invalid severity: ${severity}`);
  }
}

export function assertValidCategory(category: string): asserts category is Category {
  if (!(CATEGORIES as readonly string[]).includes(category)) {
    throw new FlagValidationError(`Invalid category: ${category}`);
  }
}

export function assertValidStatus(status: string): asserts status is Status {
  if (!(STATUSES as readonly string[]).includes(status)) {
    throw new FlagValidationError(`Invalid status: ${status}`);
  }
}

export function assertValidCreatedAt(createdAt: string): asserts createdAt is ISOString {
  if (!isISODate(createdAt)) {
    throw new FlagValidationError(`Invalid createdAt (must be ISO timestamp): ${createdAt}`);
  }
}

export function assertDescriptionNonEmpty(description: string): void {
  if (typeof description !== "string" || description.trim().length === 0) {
    throw new FlagValidationError("description must be present and non-empty");
  }
}

export function assertValidFlagRecord(record: FlagRecord): void {
  if (typeof record.id !== "string" || record.id.trim().length === 0) {
    throw new FlagValidationError("id must be non-empty string");
  }
  if (typeof record.sourceMessageId !== "string" || record.sourceMessageId.trim().length === 0) {
    throw new FlagValidationError("sourceMessageId must be non-empty string");
  }
  if (!record.sourceThreadId && record.sourceThreadId !== null) {
    throw new FlagValidationError("sourceThreadId must be string or null");
  }
  if (typeof record.reporterId !== "string" || record.reporterId.trim().length === 0) {
    throw new FlagValidationError("reporterId must be non-empty string");
  }
  if (typeof record.reporterName !== "string" || record.reporterName.trim().length === 0) {
    throw new FlagValidationError("reporterName must be non-empty string");
  }

  assertValidCreatedAt(record.createdAt);
  assertValidSeverity(record.severity);
  assertValidCategory(record.category);
  assertDescriptionNonEmpty(record.description);
  assertValidStatus(record.status);

  if (typeof record.assignedTeam !== "string" && record.assignedTeam !== null) {
    throw new FlagValidationError("assignedTeam must be string or null");
  }
  if (typeof record.triageRequired !== "boolean") {
    throw new FlagValidationError("triageRequired must be boolean");
  }

  if (!Array.isArray(record.reviewNotes)) {
    throw new FlagValidationError("reviewNotes must be array");
  }
  for (const rn of record.reviewNotes) {
    if (typeof rn.note !== "string" || rn.note.trim().length === 0) {
      throw new FlagValidationError("reviewNotes.note must be non-empty string");
    }
    assertValidCreatedAt(rn.createdAt);
  }

  if (record.resolvedAt !== null) {
    assertValidCreatedAt(record.resolvedAt);
  }
}

export function normalizeTriagedRequired(severity: Severity, status: Status): boolean {
  if (severity === "high" || severity === "critical") {
    // By contract: open+high|critical => triageRequired true by default.
    // Keep it required even as status changes unless explicitly overridden.
    return true;
  }
  return status === "open" ? false : false;
}

