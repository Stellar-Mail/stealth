export const OWNERSHIP_LIMITS = Object.freeze({
  maxEventsPerBatch: 1_000,
  maxSubjectLength: 180,
  maxNoteLength: 1_500,
  maxMessageIdLength: 160,
});

export const OWNERSHIP_ACTIONS = Object.freeze({
  CLAIMED: "claimed",
  RELEASED: "released",
  REASSIGNED: "reassigned",
  ESCALATED: "escalated",
});

const VALID_ACTIONS = new Set(Object.values(OWNERSHIP_ACTIONS));

export class OwnershipGuardError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "OwnershipGuardError";
    this.details = details;
  }
}

export function sanitizeOwnershipText(value, fieldName, options = {}) {
  const { maxLength = 1_000, required = true } = options;

  if (value === undefined || value === null) {
    if (required) {
      throw new OwnershipGuardError(`${fieldName} is required`, { fieldName });
    }

    return "";
  }

  if (typeof value !== "string") {
    throw new OwnershipGuardError(`${fieldName} must be a string`, { fieldName });
  }

  const normalized = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();

  if (required && normalized === "") {
    throw new OwnershipGuardError(`${fieldName} cannot be empty`, { fieldName });
  }

  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

export function normalizeOwnershipAddress(value, fieldName) {
  const address = sanitizeOwnershipText(value, fieldName, { maxLength: 320 }).toLowerCase();

  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address)) {
    throw new OwnershipGuardError(`${fieldName} must be a valid email-like address`, {
      fieldName,
    });
  }

  return address;
}

function normalizeOptionalAddress(value, fieldName) {
  if (value === undefined || value === null || value === "") {
    return "";
  }

  return normalizeOwnershipAddress(value, fieldName);
}

export function parseOwnershipTimestamp(value, fieldName = "occurredAt") {
  const timestamp = sanitizeOwnershipText(value, fieldName, { maxLength: 64 });
  const parsed = new Date(timestamp);

  if (Number.isNaN(parsed.getTime())) {
    throw new OwnershipGuardError(`${fieldName} must be a valid ISO timestamp`, { fieldName });
  }

  return parsed.toISOString();
}

export function normalizeOwnershipEvent(event) {
  if (!event || typeof event !== "object") {
    throw new OwnershipGuardError("ownership event must be an object");
  }

  const action = sanitizeOwnershipText(event.action, "action", { maxLength: 32 });

  if (!VALID_ACTIONS.has(action)) {
    throw new OwnershipGuardError("ownership action is not supported", { action });
  }

  const ownerAddress = normalizeOptionalAddress(event.ownerAddress, "ownerAddress");
  const previousOwnerAddress = normalizeOptionalAddress(
    event.previousOwnerAddress,
    "previousOwnerAddress",
  );

  if (
    (action === OWNERSHIP_ACTIONS.CLAIMED || action === OWNERSHIP_ACTIONS.REASSIGNED) &&
    ownerAddress === ""
  ) {
    throw new OwnershipGuardError("ownerAddress is required for ownership assignment", {
      action,
    });
  }

  if (action === OWNERSHIP_ACTIONS.REASSIGNED && previousOwnerAddress === "") {
    throw new OwnershipGuardError("previousOwnerAddress is required for reassignment", {
      action,
    });
  }

  return {
    eventId: sanitizeOwnershipText(event.eventId, "eventId", { maxLength: 160 }),
    messageId: sanitizeOwnershipText(event.messageId, "messageId", {
      maxLength: OWNERSHIP_LIMITS.maxMessageIdLength,
    }),
    sharedInboxAddress: normalizeOwnershipAddress(event.sharedInboxAddress, "sharedInboxAddress"),
    subject: sanitizeOwnershipText(event.subject, "subject", {
      maxLength: OWNERSHIP_LIMITS.maxSubjectLength,
    }),
    action,
    actorAddress: normalizeOwnershipAddress(event.actorAddress, "actorAddress"),
    ownerAddress,
    previousOwnerAddress,
    occurredAt: parseOwnershipTimestamp(event.occurredAt),
    note: sanitizeOwnershipText(event.note, "note", {
      maxLength: OWNERSHIP_LIMITS.maxNoteLength,
      required: false,
    }),
  };
}

export function buildOwnershipTimeline(events, options = {}) {
  if (!Array.isArray(events)) {
    throw new OwnershipGuardError("ownership events must be an array");
  }

  const maxEvents = options.maxEventsPerBatch ?? OWNERSHIP_LIMITS.maxEventsPerBatch;

  if (events.length > maxEvents) {
    throw new OwnershipGuardError("ownership event batch is too large", {
      maxEvents,
      receivedEvents: events.length,
    });
  }

  return events
    .map((event) => normalizeOwnershipEvent(event))
    .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
}

export function summarizeCurrentOwnership(timeline) {
  if (!Array.isArray(timeline)) {
    throw new OwnershipGuardError("ownership timeline must be an array");
  }

  const byMessage = new Map();

  for (const event of timeline) {
    const current = byMessage.get(event.messageId) ?? {
      messageId: event.messageId,
      subject: event.subject,
      sharedInboxAddress: event.sharedInboxAddress,
      ownerAddress: "",
      lastAction: "",
      lastActorAddress: "",
      updatedAt: "",
      handoffCount: 0,
      escalationCount: 0,
    };

    if (event.action === OWNERSHIP_ACTIONS.CLAIMED) {
      current.ownerAddress = event.ownerAddress;
    }

    if (event.action === OWNERSHIP_ACTIONS.REASSIGNED) {
      current.ownerAddress = event.ownerAddress;
      current.handoffCount += 1;
    }

    if (event.action === OWNERSHIP_ACTIONS.RELEASED) {
      current.ownerAddress = "";
    }

    if (event.action === OWNERSHIP_ACTIONS.ESCALATED) {
      current.escalationCount += 1;
    }

    current.subject = event.subject;
    current.sharedInboxAddress = event.sharedInboxAddress;
    current.lastAction = event.action;
    current.lastActorAddress = event.actorAddress;
    current.updatedAt = event.occurredAt;
    byMessage.set(event.messageId, current);
  }

  return [...byMessage.values()].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function prepareOwnershipClaim(input) {
  if (!input || typeof input !== "object") {
    throw new OwnershipGuardError("claim input must be an object");
  }

  return {
    messageId: sanitizeOwnershipText(input.messageId, "messageId", {
      maxLength: OWNERSHIP_LIMITS.maxMessageIdLength,
    }),
    actorAddress: normalizeOwnershipAddress(input.actorAddress, "actorAddress"),
    ownerAddress: normalizeOwnershipAddress(input.ownerAddress ?? input.actorAddress, "ownerAddress"),
    note: sanitizeOwnershipText(input.note, "note", {
      maxLength: OWNERSHIP_LIMITS.maxNoteLength,
      required: false,
    }),
  };
}
