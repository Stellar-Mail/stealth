export const DEADLINE_STATES = Object.freeze({
  OK: "ok",
  DUE_SOON: "due-soon",
  BREACHED: "breached",
  RESOLVED: "resolved",
});

const DEFAULT_DUE_SOON_WINDOW_MINUTES = 30;
const MAX_RECORDS = 500;

export class SlaDeadlineValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "SlaDeadlineValidationError";
    this.details = details;
  }
}

export function parseIsoDate(value, fieldName) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new SlaDeadlineValidationError(`${fieldName} must be a non-empty ISO timestamp`, {
      fieldName,
    });
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new SlaDeadlineValidationError(`${fieldName} must be a valid ISO timestamp`, {
      fieldName,
      value,
    });
  }

  return parsed;
}

export function normalizeSlaPolicy(policy) {
  if (!policy || typeof policy !== "object") {
    throw new SlaDeadlineValidationError("SLA policy is required");
  }

  if (typeof policy.name !== "string" || policy.name.trim() === "") {
    throw new SlaDeadlineValidationError("SLA policy name is required", { fieldName: "name" });
  }

  if (!Number.isFinite(policy.targetMinutes) || policy.targetMinutes <= 0) {
    throw new SlaDeadlineValidationError("SLA targetMinutes must be a positive number", {
      fieldName: "targetMinutes",
    });
  }

  const dueSoonWindowMinutes =
    policy.dueSoonWindowMinutes === undefined
      ? DEFAULT_DUE_SOON_WINDOW_MINUTES
      : policy.dueSoonWindowMinutes;

  if (!Number.isFinite(dueSoonWindowMinutes) || dueSoonWindowMinutes < 0) {
    throw new SlaDeadlineValidationError("SLA dueSoonWindowMinutes must be zero or positive", {
      fieldName: "dueSoonWindowMinutes",
    });
  }

  return {
    name: policy.name.trim(),
    targetMinutes: policy.targetMinutes,
    dueSoonWindowMinutes,
  };
}

export function normalizeDeadlineRecord(record) {
  if (!record || typeof record !== "object") {
    throw new SlaDeadlineValidationError("Deadline record is required");
  }

  for (const fieldName of ["id", "messageId", "sharedInboxId", "subject", "receivedAt"]) {
    if (typeof record[fieldName] !== "string" || record[fieldName].trim() === "") {
      throw new SlaDeadlineValidationError(`${fieldName} is required`, { fieldName });
    }
  }

  const policy = normalizeSlaPolicy(record.policy);
  const receivedAt = parseIsoDate(record.receivedAt, "receivedAt");
  const resolvedAt = record.resolvedAt ? parseIsoDate(record.resolvedAt, "resolvedAt") : null;
  const dueAt = new Date(receivedAt.getTime() + policy.targetMinutes * 60_000);

  return {
    id: record.id.trim(),
    messageId: record.messageId.trim(),
    sharedInboxId: record.sharedInboxId.trim(),
    subject: record.subject.trim(),
    receivedAt: receivedAt.toISOString(),
    dueAt: dueAt.toISOString(),
    resolvedAt: resolvedAt ? resolvedAt.toISOString() : null,
    policy,
    assignee: typeof record.assignee === "string" ? record.assignee.trim() : "",
    escalationNote: typeof record.escalationNote === "string" ? record.escalationNote.trim() : "",
  };
}

export function evaluateDeadlineState(record, options = {}) {
  const normalized = normalizeDeadlineRecord(record);

  if (normalized.resolvedAt) {
    return {
      ...normalized,
      state: DEADLINE_STATES.RESOLVED,
      minutesUntilDue: null,
      isActionable: false,
    };
  }

  const now = options.now ? parseIsoDate(options.now, "now") : new Date();
  const dueAt = parseIsoDate(normalized.dueAt, "dueAt");
  const minutesUntilDue = Math.ceil((dueAt.getTime() - now.getTime()) / 60_000);
  const state =
    minutesUntilDue < 0
      ? DEADLINE_STATES.BREACHED
      : minutesUntilDue <= normalized.policy.dueSoonWindowMinutes
        ? DEADLINE_STATES.DUE_SOON
        : DEADLINE_STATES.OK;

  return {
    ...normalized,
    state,
    minutesUntilDue,
    isActionable: state === DEADLINE_STATES.DUE_SOON || state === DEADLINE_STATES.BREACHED,
  };
}

export function buildDeadlineQueue(records, options = {}) {
  if (!Array.isArray(records)) {
    throw new SlaDeadlineValidationError("Deadline records must be an array");
  }

  if (records.length > (options.maxRecords ?? MAX_RECORDS)) {
    throw new SlaDeadlineValidationError("Deadline record batch is too large", {
      maxRecords: options.maxRecords ?? MAX_RECORDS,
      receivedRecords: records.length,
    });
  }

  return records
    .map((record) => evaluateDeadlineState(record, options))
    .sort((a, b) => {
      if (a.state === DEADLINE_STATES.RESOLVED && b.state !== DEADLINE_STATES.RESOLVED) {
        return 1;
      }

      if (b.state === DEADLINE_STATES.RESOLVED && a.state !== DEADLINE_STATES.RESOLVED) {
        return -1;
      }

      return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
    });
}

export function filterDeadlineQueue(queue, filters = {}) {
  if (!Array.isArray(queue)) {
    throw new SlaDeadlineValidationError("Deadline queue must be an array");
  }

  return queue.filter((item) => {
    const matchesState = filters.state ? item.state === filters.state : true;
    const matchesAssignee = filters.assignee ? item.assignee === filters.assignee : true;
    const matchesInbox = filters.sharedInboxId ? item.sharedInboxId === filters.sharedInboxId : true;

    return matchesState && matchesAssignee && matchesInbox;
  });
}

export function summarizeDeadlineQueue(queue) {
  if (!Array.isArray(queue)) {
    throw new SlaDeadlineValidationError("Deadline queue must be an array");
  }

  const summary = {
    total: queue.length,
    ok: 0,
    dueSoon: 0,
    breached: 0,
    resolved: 0,
    actionable: 0,
  };

  for (const item of queue) {
    if (item.state === DEADLINE_STATES.OK) summary.ok += 1;
    if (item.state === DEADLINE_STATES.DUE_SOON) summary.dueSoon += 1;
    if (item.state === DEADLINE_STATES.BREACHED) summary.breached += 1;
    if (item.state === DEADLINE_STATES.RESOLVED) summary.resolved += 1;
    if (item.isActionable) summary.actionable += 1;
  }

  return summary;
}
