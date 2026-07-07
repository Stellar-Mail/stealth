/**
 * Security and performance guards for the Deadline Detector.
 *
 * These helpers are pure, synchronous, and folder-local. Future integration
 * code should call them before running detection over mailbox, attachment, or
 * history data. They do not read inbox state, write reminders, call providers,
 * or persist anything.
 */

const ALLOWED_SOURCE_TYPES = new Set(["email", "calendar-forward", "invoice", "project-update"]);
const MESSAGE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const TIMEZONE_PATTERN = /^[A-Za-z0-9_+\-/.]+$/;

export const DEADLINE_GUARD_LIMITS = {
  MAX_MESSAGE_BATCH_SIZE: 100,
  MAX_MESSAGE_ID_LENGTH: 96,
  MAX_SENDER_LENGTH: 254,
  MAX_SUBJECT_LENGTH: 998,
  MAX_BODY_LENGTH: 20_000,
  MAX_TIMEZONE_LENGTH: 80,
  MAX_ATTACHMENT_COUNT: 25,
  MAX_ATTACHMENT_NAME_LENGTH: 180,
  MAX_ATTACHMENT_BYTES: 10_000_000,
  MAX_HISTORY_EVENTS: 500,
};

const CONTROL_CHARACTERS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g;
const INVISIBLE_CHARACTERS = /[\u200b-\u200d\u2060\ufeff]/g;
const HTML_TAGS = /<[^>]*>/g;

export class DeadlineGuardError extends Error {
  constructor(message, field) {
    super(message);
    this.name = "DeadlineGuardError";
    this.field = field;
  }
}

export function sanitizeDeadlineText(value, maxLength = DEADLINE_GUARD_LIMITS.MAX_BODY_LENGTH) {
  if (typeof value !== "string") {
    return "";
  }
  return value
    .normalize("NFC")
    .replace(HTML_TAGS, "")
    .replace(CONTROL_CHARACTERS, "")
    .replace(INVISIBLE_CHARACTERS, "")
    .trim()
    .slice(0, maxLength);
}

export function validateMessageId(id) {
  if (typeof id !== "string" || id.length === 0) {
    throw new DeadlineGuardError("message id must be a non-empty string", "id");
  }
  if (id.length > DEADLINE_GUARD_LIMITS.MAX_MESSAGE_ID_LENGTH) {
    throw new DeadlineGuardError(
      `message id exceeds ${DEADLINE_GUARD_LIMITS.MAX_MESSAGE_ID_LENGTH} characters`,
      "id",
    );
  }
  if (!MESSAGE_ID_PATTERN.test(id)) {
    throw new DeadlineGuardError(
      "message id may contain only letters, numbers, underscore, and dash",
      "id",
    );
  }
  return id;
}

export function validateSourceType(type) {
  if (typeof type !== "string" || type.length === 0) {
    throw new DeadlineGuardError("message type must be a non-empty string", "type");
  }
  if (!ALLOWED_SOURCE_TYPES.has(type)) {
    throw new DeadlineGuardError(`unsupported message type: ${type}`, "type");
  }
  return type;
}

export function validateSender(sender) {
  if (typeof sender !== "string" || sender.length === 0) {
    throw new DeadlineGuardError("sender must be a non-empty string", "sender");
  }
  if (sender.length > DEADLINE_GUARD_LIMITS.MAX_SENDER_LENGTH) {
    throw new DeadlineGuardError(
      `sender exceeds ${DEADLINE_GUARD_LIMITS.MAX_SENDER_LENGTH} characters`,
      "sender",
    );
  }
  if (/[\r\n\0]/.test(sender)) {
    throw new DeadlineGuardError("sender contains header injection characters", "sender");
  }
  const at = sender.lastIndexOf("@");
  if (at < 1 || at === sender.length - 1) {
    throw new DeadlineGuardError("sender must include local part and domain", "sender");
  }
  return sender;
}

export function validateIsoTimestamp(value, field = "timestamp") {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    throw new DeadlineGuardError(`${field} must be an ISO timestamp string`, field);
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new DeadlineGuardError(`${field} must be parseable as a date`, field);
  }
  return value;
}

export function validateTimezone(timezone) {
  if (typeof timezone !== "string" || timezone.length === 0) {
    throw new DeadlineGuardError("timezone must be a non-empty string", "userTimezone");
  }
  if (timezone.length > DEADLINE_GUARD_LIMITS.MAX_TIMEZONE_LENGTH) {
    throw new DeadlineGuardError(
      `timezone exceeds ${DEADLINE_GUARD_LIMITS.MAX_TIMEZONE_LENGTH} characters`,
      "userTimezone",
    );
  }
  if (!TIMEZONE_PATTERN.test(timezone)) {
    throw new DeadlineGuardError("timezone contains unsupported characters", "userTimezone");
  }
  return timezone;
}

export function sanitizeDeadlineMessage(message) {
  if (message === null || typeof message !== "object" || Array.isArray(message)) {
    throw new DeadlineGuardError("deadline message must be a plain object", "message");
  }

  const subject = sanitizeDeadlineText(message.subject, DEADLINE_GUARD_LIMITS.MAX_SUBJECT_LENGTH);
  const body = sanitizeDeadlineText(message.body, DEADLINE_GUARD_LIMITS.MAX_BODY_LENGTH);

  if (subject.length === 0) {
    throw new DeadlineGuardError("subject must contain visible text", "subject");
  }
  if (body.length === 0) {
    throw new DeadlineGuardError("body must contain visible text", "body");
  }
  if (typeof message.containsPersonalData !== "boolean") {
    throw new DeadlineGuardError("containsPersonalData must be boolean", "containsPersonalData");
  }

  return {
    id: validateMessageId(message.id),
    type: validateSourceType(message.type),
    sender: validateSender(message.sender),
    subject,
    body,
    receivedAt: validateIsoTimestamp(message.receivedAt, "receivedAt"),
    containsPersonalData: message.containsPersonalData,
    userTimezone: validateTimezone(message.userTimezone),
  };
}

export function guardDeadlineMessageBatch(messages) {
  if (!Array.isArray(messages)) {
    throw new DeadlineGuardError("messages must be an array", "messages");
  }
  if (messages.length > DEADLINE_GUARD_LIMITS.MAX_MESSAGE_BATCH_SIZE) {
    throw new DeadlineGuardError(
      `message batch size ${messages.length} exceeds ${DEADLINE_GUARD_LIMITS.MAX_MESSAGE_BATCH_SIZE}; paginate before detecting`,
      "messages",
    );
  }
  return messages.map((message) => sanitizeDeadlineMessage(message));
}

export function guardAttachmentMetadata(attachments = []) {
  if (!Array.isArray(attachments)) {
    throw new DeadlineGuardError("attachments must be an array", "attachments");
  }
  if (attachments.length > DEADLINE_GUARD_LIMITS.MAX_ATTACHMENT_COUNT) {
    throw new DeadlineGuardError(
      `attachment count ${attachments.length} exceeds ${DEADLINE_GUARD_LIMITS.MAX_ATTACHMENT_COUNT}`,
      "attachments",
    );
  }

  return attachments.map((attachment, index) => {
    if (attachment === null || typeof attachment !== "object" || Array.isArray(attachment)) {
      throw new DeadlineGuardError(`attachment ${index} must be a plain object`, "attachments");
    }
    if ("content" in attachment || "bytes" in attachment || "buffer" in attachment) {
      throw new DeadlineGuardError(
        "attachment content is out of scope; pass metadata only",
        "attachments",
      );
    }
    const name = sanitizeDeadlineText(
      attachment.name,
      DEADLINE_GUARD_LIMITS.MAX_ATTACHMENT_NAME_LENGTH,
    );
    if (name.length === 0) {
      throw new DeadlineGuardError("attachment name must contain visible text", "attachments");
    }
    if (!Number.isInteger(attachment.sizeBytes) || attachment.sizeBytes < 0) {
      throw new DeadlineGuardError(
        "attachment sizeBytes must be a non-negative integer",
        "attachments",
      );
    }
    if (attachment.sizeBytes > DEADLINE_GUARD_LIMITS.MAX_ATTACHMENT_BYTES) {
      throw new DeadlineGuardError(
        `attachment exceeds ${DEADLINE_GUARD_LIMITS.MAX_ATTACHMENT_BYTES} bytes`,
        "attachments",
      );
    }
    return {
      name,
      sizeBytes: attachment.sizeBytes,
    };
  });
}

export function guardHistoryWindow(events = []) {
  if (!Array.isArray(events)) {
    throw new DeadlineGuardError("history events must be an array", "history");
  }
  if (events.length > DEADLINE_GUARD_LIMITS.MAX_HISTORY_EVENTS) {
    throw new DeadlineGuardError(
      `history size ${events.length} exceeds ${DEADLINE_GUARD_LIMITS.MAX_HISTORY_EVENTS}; request a smaller window`,
      "history",
    );
  }
  return true;
}

export function guardDetectionRequest(request) {
  if (request === null || typeof request !== "object" || Array.isArray(request)) {
    throw new DeadlineGuardError("detection request must be a plain object", "request");
  }

  const messages = guardDeadlineMessageBatch(request.messages);
  const options = {};

  if (request.options?.now !== undefined) {
    options.now = validateIsoTimestamp(request.options.now, "now");
  }
  if (request.options?.defaultTimezone !== undefined) {
    options.defaultTimezone = validateTimezone(request.options.defaultTimezone);
  }

  return { messages, options };
}

export { ALLOWED_SOURCE_TYPES };
