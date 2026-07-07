const ALLOWED_ACTIONS = new Set(["claim", "assign", "transfer", "release", "escalate"]);

const LIMITS = {
  MAX_EVENT_ID_LENGTH: 128,
  MAX_MESSAGE_ID_LENGTH: 160,
  MAX_OWNER_EMAIL_LENGTH: 254,
  MAX_ACTOR_EMAIL_LENGTH: 254,
  MAX_DISPLAY_NAME_LENGTH: 120,
  MAX_REASON_LENGTH: 1_200,
  MAX_TEAM_ID_LENGTH: 96,
  MAX_TAG_COUNT: 20,
  MAX_TAG_LENGTH: 48,
  MAX_ATTACHMENT_COUNT: 30,
  MAX_ATTACHMENT_NAME_LENGTH: 180,
  MAX_ATTACHMENT_TYPE_LENGTH: 120,
  MAX_ATTACHMENT_BYTES: 50 * 1024 * 1024,
  MAX_HISTORY_EVENTS: 500,
  MAX_TEAM_MEMBERS: 250,
};

const ID_PATTERN = /^[A-Za-z0-9._:@-]+$/;
const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g;
const HTML_TAGS = /<[^>]*>/g;

export class OwnershipBoundaryError extends Error {
  constructor(message, field) {
    super(message);
    this.name = "OwnershipBoundaryError";
    this.field = field;
  }
}

function withLimits(overrides = {}) {
  return { ...LIMITS, ...overrides };
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function sanitizeText(value, maxLength, field = "text") {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
    throw new OwnershipBoundaryError(`${field} must be a primitive value`, field);
  }

  let text = String(value).replace(CONTROL_CHARS, "").replace(HTML_TAGS, "").trim();
  text = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n");

  if (text.length > maxLength) {
    text = text.slice(0, maxLength);
  }

  return text;
}

export function validateTrackerId(value, field = "id", maxLength = LIMITS.MAX_EVENT_ID_LENGTH) {
  if (typeof value !== "string") {
    throw new OwnershipBoundaryError(`${field} must be a string`, field);
  }

  const id = value.trim();
  if (id.length === 0) {
    throw new OwnershipBoundaryError(`${field} must not be empty`, field);
  }

  if (id.length > maxLength) {
    throw new OwnershipBoundaryError(`${field} exceeds ${maxLength} characters`, field);
  }

  if (id.includes("..") || /[\\/<>#?%&\s]/.test(id) || !ID_PATTERN.test(id)) {
    throw new OwnershipBoundaryError(`${field} contains unsafe characters`, field);
  }

  return id;
}

export function normalizeEmail(value, field = "email", maxLength = LIMITS.MAX_OWNER_EMAIL_LENGTH) {
  if (typeof value !== "string") {
    throw new OwnershipBoundaryError(`${field} must be a string`, field);
  }

  const email = value.trim().toLowerCase();
  if (email.length === 0) {
    throw new OwnershipBoundaryError(`${field} must not be empty`, field);
  }

  if (email.length > maxLength) {
    throw new OwnershipBoundaryError(`${field} exceeds ${maxLength} characters`, field);
  }

  if (/[\r\n\0]/.test(email) || !EMAIL_PATTERN.test(email)) {
    throw new OwnershipBoundaryError(`${field} is not a safe email address`, field);
  }

  return email;
}

export function validateOwnershipAction(value) {
  if (typeof value !== "string") {
    throw new OwnershipBoundaryError("action must be a string", "action");
  }

  const action = value.trim().toLowerCase();
  if (!ALLOWED_ACTIONS.has(action)) {
    throw new OwnershipBoundaryError(
      `action must be one of: ${[...ALLOWED_ACTIONS].join(", ")}`,
      "action",
    );
  }

  return action;
}

export function normalizeTimestamp(value, field = "createdAt") {
  if (typeof value !== "string") {
    throw new OwnershipBoundaryError(`${field} must be an ISO timestamp string`, field);
  }

  const timestamp = value.trim();
  const parsed = Date.parse(timestamp);
  if (!ISO_TIMESTAMP_PATTERN.test(timestamp) || !Number.isFinite(parsed)) {
    throw new OwnershipBoundaryError(`${field} must be a valid UTC ISO timestamp`, field);
  }

  return new Date(parsed).toISOString();
}

export function sanitizeTags(value, limits = LIMITS) {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new OwnershipBoundaryError("tags must be an array", "tags");
  }

  if (value.length > limits.MAX_TAG_COUNT) {
    throw new OwnershipBoundaryError(`tags exceed safe limit of ${limits.MAX_TAG_COUNT}`, "tags");
  }

  const seen = new Set();
  const tags = [];

  for (const tag of value) {
    const clean = sanitizeText(tag, limits.MAX_TAG_LENGTH, "tags").toLowerCase();
    if (clean.length === 0) {
      continue;
    }
    if (/[\\/<>#?%&]/.test(clean)) {
      throw new OwnershipBoundaryError("tag contains unsafe characters", "tags");
    }
    if (!seen.has(clean)) {
      seen.add(clean);
      tags.push(clean);
    }
  }

  return tags;
}

export function sanitizeAttachmentMetadata(value, options = {}) {
  const limits = withLimits(options);

  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new OwnershipBoundaryError("attachments must be an array", "attachments");
  }

  if (value.length > limits.MAX_ATTACHMENT_COUNT) {
    throw new OwnershipBoundaryError(
      `attachments exceed safe limit of ${limits.MAX_ATTACHMENT_COUNT}`,
      "attachments",
    );
  }

  let totalBytes = 0;
  return value.map((attachment, index) => {
    if (!isPlainObject(attachment)) {
      throw new OwnershipBoundaryError(`attachment ${index} must be an object`, "attachments");
    }

    const name = sanitizeText(
      attachment.name ?? attachment.filename ?? "",
      limits.MAX_ATTACHMENT_NAME_LENGTH,
      "attachments.name",
    );
    const contentType = sanitizeText(
      attachment.contentType ?? attachment.type ?? "application/octet-stream",
      limits.MAX_ATTACHMENT_TYPE_LENGTH,
      "attachments.contentType",
    ).toLowerCase();
    const sizeBytes = Number(attachment.sizeBytes ?? attachment.size ?? 0);

    if (!Number.isInteger(sizeBytes) || sizeBytes < 0) {
      throw new OwnershipBoundaryError(
        `attachment ${index} has invalid size`,
        "attachments.sizeBytes",
      );
    }

    totalBytes += sizeBytes;
    if (totalBytes > limits.MAX_ATTACHMENT_BYTES) {
      throw new OwnershipBoundaryError(
        `attachments exceed byte budget of ${limits.MAX_ATTACHMENT_BYTES}`,
        "attachments.sizeBytes",
      );
    }

    return { name, contentType, sizeBytes };
  });
}

export function validateTeamMembers(value, options = {}) {
  const limits = withLimits(options);

  if (!Array.isArray(value)) {
    throw new OwnershipBoundaryError("teamMembers must be an array", "teamMembers");
  }

  if (value.length > limits.MAX_TEAM_MEMBERS) {
    throw new OwnershipBoundaryError(
      `teamMembers exceed safe limit of ${limits.MAX_TEAM_MEMBERS}`,
      "teamMembers",
    );
  }

  return value.map((member, index) => {
    if (!isPlainObject(member)) {
      throw new OwnershipBoundaryError(`team member ${index} must be an object`, "teamMembers");
    }

    return {
      id: validateTrackerId(member.id, "teamMembers.id", limits.MAX_TEAM_ID_LENGTH),
      email: normalizeEmail(member.email, "teamMembers.email"),
      displayName: sanitizeText(
        member.displayName ?? member.name ?? "",
        limits.MAX_DISPLAY_NAME_LENGTH,
        "teamMembers.displayName",
      ),
    };
  });
}

export function validateOwnershipEvent(value, options = {}) {
  const limits = withLimits(options);

  if (!isPlainObject(value)) {
    throw new OwnershipBoundaryError("ownership event must be an object", "event");
  }

  const action = validateOwnershipAction(value.action);
  const normalized = {
    eventId: validateTrackerId(value.eventId ?? value.id, "eventId", limits.MAX_EVENT_ID_LENGTH),
    messageId: validateTrackerId(value.messageId, "messageId", limits.MAX_MESSAGE_ID_LENGTH),
    action,
    actorEmail: normalizeEmail(value.actorEmail, "actorEmail", limits.MAX_ACTOR_EMAIL_LENGTH),
    createdAt: normalizeTimestamp(value.createdAt),
    ownerEmail: null,
    ownerDisplayName: sanitizeText(
      value.ownerDisplayName ?? "",
      limits.MAX_DISPLAY_NAME_LENGTH,
      "ownerDisplayName",
    ),
    reason: sanitizeText(value.reason ?? "", limits.MAX_REASON_LENGTH, "reason"),
    teamId: value.teamId
      ? validateTrackerId(value.teamId, "teamId", limits.MAX_TEAM_ID_LENGTH)
      : null,
    tags: sanitizeTags(value.tags, limits),
    attachments: sanitizeAttachmentMetadata(value.attachments, limits),
  };

  if (action !== "release") {
    normalized.ownerEmail = normalizeEmail(
      value.ownerEmail,
      "ownerEmail",
      limits.MAX_OWNER_EMAIL_LENGTH,
    );
  } else if (
    value.ownerEmail !== undefined &&
    value.ownerEmail !== null &&
    value.ownerEmail !== ""
  ) {
    normalized.ownerEmail = normalizeEmail(
      value.ownerEmail,
      "ownerEmail",
      limits.MAX_OWNER_EMAIL_LENGTH,
    );
  }

  return normalized;
}

export function guardOwnershipHistory(value, options = {}) {
  const limits = withLimits(options);

  if (!Array.isArray(value)) {
    throw new OwnershipBoundaryError("ownership history must be an array", "history");
  }

  if (value.length > limits.MAX_HISTORY_EVENTS) {
    throw new OwnershipBoundaryError(
      `ownership history exceeds safe limit of ${limits.MAX_HISTORY_EVENTS}`,
      "history",
    );
  }

  return true;
}

export function prepareOwnershipHistory(value, options = {}) {
  guardOwnershipHistory(value, options);
  return value.map((event) => validateOwnershipEvent(event, options));
}

export function deriveCurrentOwners(value, options = {}) {
  const events = prepareOwnershipHistory(value, options);
  const ownersByMessageId = new Map();

  for (const event of events) {
    if (event.action === "release") {
      ownersByMessageId.delete(event.messageId);
      continue;
    }

    ownersByMessageId.set(event.messageId, {
      messageId: event.messageId,
      ownerEmail: event.ownerEmail,
      ownerDisplayName: event.ownerDisplayName,
      action: event.action,
      actorEmail: event.actorEmail,
      createdAt: event.createdAt,
      tags: event.tags,
    });
  }

  return {
    count: ownersByMessageId.size,
    owners: [...ownersByMessageId.values()],
  };
}

export { ALLOWED_ACTIONS, LIMITS };
