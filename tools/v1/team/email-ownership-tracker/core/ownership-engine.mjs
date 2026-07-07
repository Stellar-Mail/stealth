const ACTIONS = new Set(["claim", "release", "transfer"]);

const LIMITS = {
  MAX_EVENTS: 500,
  MAX_MESSAGE_ID_LENGTH: 160,
  MAX_EVENT_ID_LENGTH: 120,
  MAX_EMAIL_LENGTH: 254,
  MAX_REASON_LENGTH: 800,
  MAX_SUBJECT_LENGTH: 240,
};

const SAFE_ID = /^[A-Za-z0-9._:@-]+$/;
const SAFE_EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const UTC_ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g;
const TAGS = /<[^>]*>/g;

export class OwnershipEngineError extends Error {
  constructor(code, message, field = "input") {
    super(message);
    this.name = "OwnershipEngineError";
    this.code = code;
    this.field = field;
  }
}

function assertPlainObject(value, field) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new OwnershipEngineError("invalid-shape", `${field} must be an object`, field);
  }
}

function sanitizeText(value, limit, field) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
    throw new OwnershipEngineError("invalid-text", `${field} must be a primitive value`, field);
  }

  return String(value).replace(CONTROL_CHARS, "").replace(TAGS, "").trim().slice(0, limit);
}

export function normalizeId(value, field = "id", limit = LIMITS.MAX_EVENT_ID_LENGTH) {
  if (typeof value !== "string") {
    throw new OwnershipEngineError("invalid-id", `${field} must be a string`, field);
  }

  const id = value.trim();
  if (
    !id ||
    id.length > limit ||
    id.includes("..") ||
    /[\\/<>#?%&\s]/.test(id) ||
    !SAFE_ID.test(id)
  ) {
    throw new OwnershipEngineError("invalid-id", `${field} is not a safe identifier`, field);
  }

  return id;
}

export function normalizeEmail(value, field = "email") {
  if (typeof value !== "string") {
    throw new OwnershipEngineError("invalid-email", `${field} must be a string`, field);
  }

  const email = value.trim().toLowerCase();
  if (
    !email ||
    email.length > LIMITS.MAX_EMAIL_LENGTH ||
    /[\r\n\0]/.test(email) ||
    !SAFE_EMAIL.test(email)
  ) {
    throw new OwnershipEngineError("invalid-email", `${field} is not a safe email address`, field);
  }

  return email;
}

export function normalizeTimestamp(value, field = "createdAt") {
  if (typeof value !== "string") {
    throw new OwnershipEngineError("invalid-timestamp", `${field} must be an ISO timestamp`, field);
  }

  const time = value.trim();
  const parsed = Date.parse(time);
  if (!UTC_ISO_TIMESTAMP.test(time) || !Number.isFinite(parsed)) {
    throw new OwnershipEngineError(
      "invalid-timestamp",
      `${field} must be a UTC ISO timestamp`,
      field,
    );
  }

  return new Date(parsed).toISOString();
}

export function normalizeOwnershipEvent(value) {
  assertPlainObject(value, "event");

  const action = String(value.action ?? "")
    .trim()
    .toLowerCase();
  if (!ACTIONS.has(action)) {
    throw new OwnershipEngineError(
      "invalid-action",
      "action must be claim, release, or transfer",
      "action",
    );
  }

  const normalized = {
    eventId: normalizeId(value.eventId ?? value.id, "eventId", LIMITS.MAX_EVENT_ID_LENGTH),
    messageId: normalizeId(value.messageId, "messageId", LIMITS.MAX_MESSAGE_ID_LENGTH),
    action,
    actorEmail: normalizeEmail(value.actorEmail, "actorEmail"),
    createdAt: normalizeTimestamp(value.createdAt),
    reason: sanitizeText(value.reason ?? "", LIMITS.MAX_REASON_LENGTH, "reason"),
    subject: sanitizeText(value.subject ?? "", LIMITS.MAX_SUBJECT_LENGTH, "subject"),
    ownerEmail: null,
    nextOwnerEmail: null,
  };

  if (action === "claim") {
    normalized.ownerEmail = normalizeEmail(value.ownerEmail ?? value.actorEmail, "ownerEmail");
  }

  if (action === "release") {
    normalized.ownerEmail =
      value.ownerEmail === undefined || value.ownerEmail === null || value.ownerEmail === ""
        ? normalized.actorEmail
        : normalizeEmail(value.ownerEmail, "ownerEmail");
  }

  if (action === "transfer") {
    normalized.ownerEmail =
      value.ownerEmail === undefined || value.ownerEmail === null || value.ownerEmail === ""
        ? normalized.actorEmail
        : normalizeEmail(value.ownerEmail, "ownerEmail");
    normalized.nextOwnerEmail = normalizeEmail(value.nextOwnerEmail, "nextOwnerEmail");
  }

  return normalized;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function appendHistory(current, event, outcome) {
  return [
    ...current,
    {
      eventId: event.eventId,
      action: event.action,
      actorEmail: event.actorEmail,
      ownerEmail: event.ownerEmail,
      nextOwnerEmail: event.nextOwnerEmail,
      createdAt: event.createdAt,
      outcome,
      reason: event.reason,
    },
  ];
}

function recordConflict(conflicts, event, code, message, currentOwner = null) {
  conflicts.push({
    eventId: event.eventId,
    messageId: event.messageId,
    code,
    message,
    actorEmail: event.actorEmail,
    requestedOwnerEmail: event.ownerEmail,
    currentOwnerEmail: currentOwner?.ownerEmail ?? null,
    createdAt: event.createdAt,
  });
}

export function buildOwnershipLedger(events) {
  if (!Array.isArray(events)) {
    throw new OwnershipEngineError("invalid-events", "events must be an array", "events");
  }

  if (events.length > LIMITS.MAX_EVENTS) {
    throw new OwnershipEngineError(
      "too-many-events",
      `events exceed safe limit of ${LIMITS.MAX_EVENTS}`,
      "events",
    );
  }

  const owners = new Map();
  const conflicts = [];
  const normalizedEvents = events.map(normalizeOwnershipEvent);

  for (const event of normalizedEvents) {
    const current = owners.get(event.messageId);

    if (event.action === "claim") {
      if (current && current.ownerEmail !== event.ownerEmail) {
        recordConflict(
          conflicts,
          event,
          "already-owned",
          `message ${event.messageId} is already owned`,
          current,
        );
        owners.set(event.messageId, {
          ...current,
          history: appendHistory(current.history, event, "conflict"),
        });
        continue;
      }

      owners.set(event.messageId, {
        messageId: event.messageId,
        subject: event.subject || current?.subject || "",
        ownerEmail: event.ownerEmail,
        claimedAt: current?.claimedAt ?? event.createdAt,
        updatedAt: event.createdAt,
        history: appendHistory(current?.history ?? [], event, "applied"),
      });
      continue;
    }

    if (event.action === "release") {
      if (!current) {
        recordConflict(conflicts, event, "not-owned", `message ${event.messageId} has no owner`);
        continue;
      }

      if (current.ownerEmail !== event.ownerEmail) {
        recordConflict(
          conflicts,
          event,
          "not-current-owner",
          `release requested by non-owner for ${event.messageId}`,
          current,
        );
        owners.set(event.messageId, {
          ...current,
          history: appendHistory(current.history, event, "conflict"),
        });
        continue;
      }

      owners.delete(event.messageId);
      continue;
    }

    if (event.action === "transfer") {
      if (!current) {
        recordConflict(conflicts, event, "not-owned", `message ${event.messageId} has no owner`);
        continue;
      }

      if (current.ownerEmail !== event.ownerEmail) {
        recordConflict(
          conflicts,
          event,
          "not-current-owner",
          `transfer requested by non-owner for ${event.messageId}`,
          current,
        );
        owners.set(event.messageId, {
          ...current,
          history: appendHistory(current.history, event, "conflict"),
        });
        continue;
      }

      owners.set(event.messageId, {
        ...current,
        ownerEmail: event.nextOwnerEmail,
        updatedAt: event.createdAt,
        history: appendHistory(current.history, event, "applied"),
      });
    }
  }

  const activeOwners = [...owners.values()].sort((left, right) =>
    left.messageId.localeCompare(right.messageId),
  );

  return {
    status: "ready",
    activeOwners,
    conflicts,
    summary: {
      totalEvents: normalizedEvents.length,
      activeOwners: activeOwners.length,
      conflicts: conflicts.length,
    },
  };
}

export function createOwnershipState(result, options = {}) {
  if (options.loading) {
    return { status: "loading", message: "Loading ownership history" };
  }

  if (options.error) {
    const error = options.error;
    return {
      status: "error",
      code: error.code ?? "ownership-error",
      message: error.message ?? "Ownership tracker failed",
    };
  }

  if (!result || result.activeOwners.length === 0) {
    return { status: "empty", activeOwners: [], conflicts: result?.conflicts ?? [] };
  }

  return {
    status: "ready",
    activeOwners: clone(result.activeOwners),
    conflicts: clone(result.conflicts),
    summary: { ...result.summary },
  };
}

export function createOwnershipEngine(initialEvents = [], options = {}) {
  const now = options.now ?? (() => new Date().toISOString());
  const prefix = options.idPrefix ?? "ownership-event";
  let counter = options.startAt ?? 0;
  let events = initialEvents.map(normalizeOwnershipEvent);

  function nextEventId() {
    counter += 1;
    return `${prefix}-${String(counter).padStart(3, "0")}`;
  }

  function append(event) {
    const normalized = normalizeOwnershipEvent(event);
    events = [...events, normalized];
    return clone(normalized);
  }

  return {
    listEvents() {
      return clone(events);
    },

    getLedger() {
      return createOwnershipState(buildOwnershipLedger(events));
    },

    claim(messageId, actorEmail, details = {}) {
      return append({
        eventId: details.eventId ?? nextEventId(),
        messageId,
        action: "claim",
        actorEmail,
        ownerEmail: details.ownerEmail ?? actorEmail,
        subject: details.subject ?? "",
        reason: details.reason ?? "",
        createdAt: details.createdAt ?? now(),
      });
    },

    release(messageId, actorEmail, details = {}) {
      return append({
        eventId: details.eventId ?? nextEventId(),
        messageId,
        action: "release",
        actorEmail,
        ownerEmail: details.ownerEmail ?? actorEmail,
        reason: details.reason ?? "",
        createdAt: details.createdAt ?? now(),
      });
    },

    transfer(messageId, actorEmail, nextOwnerEmail, details = {}) {
      return append({
        eventId: details.eventId ?? nextEventId(),
        messageId,
        action: "transfer",
        actorEmail,
        ownerEmail: details.ownerEmail ?? actorEmail,
        nextOwnerEmail,
        reason: details.reason ?? "",
        createdAt: details.createdAt ?? now(),
      });
    },
  };
}

export { ACTIONS, LIMITS };
