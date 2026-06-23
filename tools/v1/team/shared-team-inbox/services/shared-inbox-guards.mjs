export const SHARED_INBOX_LIMITS = Object.freeze({
  maxMessagesPerBatch: 500,
  maxSubjectLength: 180,
  maxPreviewLength: 280,
  maxCommentLength: 2_000,
  maxReplyLength: 10_000,
  maxAttachmentCountForPreview: 10,
  maxAttachmentBytesForPreview: 10 * 1024 * 1024,
});

const VALID_STATUSES = new Set([
  "unassigned",
  "claimed",
  "in-progress",
  "awaiting-reply",
  "resolved",
]);

export class SharedInboxGuardError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "SharedInboxGuardError";
    this.details = details;
  }
}

export function sanitizeText(value, fieldName, options = {}) {
  const { maxLength = 1_000, required = true } = options;

  if (value === undefined || value === null) {
    if (required) {
      throw new SharedInboxGuardError(`${fieldName} is required`, { fieldName });
    }

    return "";
  }

  if (typeof value !== "string") {
    throw new SharedInboxGuardError(`${fieldName} must be a string`, { fieldName });
  }

  const withoutControlCharacters = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  const trimmed = withoutControlCharacters.trim();

  if (required && trimmed === "") {
    throw new SharedInboxGuardError(`${fieldName} cannot be empty`, { fieldName });
  }

  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 1)}…` : trimmed;
}

export function normalizeEmailAddress(value, fieldName) {
  const address = sanitizeText(value, fieldName, { maxLength: 320 }).toLowerCase();

  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address)) {
    throw new SharedInboxGuardError(`${fieldName} must be a valid email-like address`, {
      fieldName,
    });
  }

  return address;
}

function parseIsoDate(value, fieldName) {
  const timestamp = sanitizeText(value, fieldName, { maxLength: 64 });
  const parsed = new Date(timestamp);

  if (Number.isNaN(parsed.getTime())) {
    throw new SharedInboxGuardError(`${fieldName} must be a valid ISO timestamp`, { fieldName });
  }

  return parsed.toISOString();
}

export function normalizeSharedInboxMessage(message) {
  if (!message || typeof message !== "object") {
    throw new SharedInboxGuardError("message must be an object");
  }

  const status = sanitizeText(message.status ?? "unassigned", "status", { maxLength: 32 });

  if (!VALID_STATUSES.has(status)) {
    throw new SharedInboxGuardError("status is not supported", { status });
  }

  return {
    id: sanitizeText(message.id, "id", { maxLength: 120 }),
    senderAddress: normalizeEmailAddress(message.senderAddress, "senderAddress"),
    sharedInboxAddress: normalizeEmailAddress(message.sharedInboxAddress, "sharedInboxAddress"),
    subject: sanitizeText(message.subject, "subject", {
      maxLength: SHARED_INBOX_LIMITS.maxSubjectLength,
    }),
    preview: sanitizeText(message.preview, "preview", {
      maxLength: SHARED_INBOX_LIMITS.maxPreviewLength,
    }),
    receivedAt: parseIsoDate(message.receivedAt, "receivedAt"),
    deliveryProofHash: sanitizeText(message.deliveryProofHash, "deliveryProofHash", {
      maxLength: 160,
    }),
    status,
    assigneeAddress: message.assigneeAddress
      ? normalizeEmailAddress(message.assigneeAddress, "assigneeAddress")
      : "",
    internalCommentCount: Number.isSafeInteger(message.internalCommentCount)
      ? Math.max(0, message.internalCommentCount)
      : 0,
    replyCount: Number.isSafeInteger(message.replyCount) ? Math.max(0, message.replyCount) : 0,
  };
}

export function buildSharedInboxQueue(messages, options = {}) {
  if (!Array.isArray(messages)) {
    throw new SharedInboxGuardError("messages must be an array");
  }

  const maxMessages = options.maxMessagesPerBatch ?? SHARED_INBOX_LIMITS.maxMessagesPerBatch;

  if (messages.length > maxMessages) {
    throw new SharedInboxGuardError("message batch is too large", {
      maxMessages,
      receivedMessages: messages.length,
    });
  }

  return messages
    .map((message) => normalizeSharedInboxMessage(message))
    .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
}

export function prepareInternalCommentDraft(input) {
  if (!input || typeof input !== "object") {
    throw new SharedInboxGuardError("comment input must be an object");
  }

  return {
    messageId: sanitizeText(input.messageId, "messageId", { maxLength: 120 }),
    authorAddress: normalizeEmailAddress(input.authorAddress, "authorAddress"),
    body: sanitizeText(input.body, "body", {
      maxLength: SHARED_INBOX_LIMITS.maxCommentLength,
    }),
    visibility: "team-only",
  };
}

export function prepareReplyDraft(input) {
  if (!input || typeof input !== "object") {
    throw new SharedInboxGuardError("reply input must be an object");
  }

  return {
    messageId: sanitizeText(input.messageId, "messageId", { maxLength: 120 }),
    fromSharedInboxAddress: normalizeEmailAddress(
      input.fromSharedInboxAddress,
      "fromSharedInboxAddress",
    ),
    toAddress: normalizeEmailAddress(input.toAddress, "toAddress"),
    subject: sanitizeText(input.subject, "subject", {
      maxLength: SHARED_INBOX_LIMITS.maxSubjectLength,
    }),
    body: sanitizeText(input.body, "body", {
      maxLength: SHARED_INBOX_LIMITS.maxReplyLength,
    }),
  };
}

export function shouldDeferAttachmentPreview(attachments, limits = SHARED_INBOX_LIMITS) {
  if (!Array.isArray(attachments)) {
    throw new SharedInboxGuardError("attachments must be an array");
  }

  const totalBytes = attachments.reduce((sum, attachment) => {
    const sizeBytes = Number.isFinite(attachment?.sizeBytes) ? attachment.sizeBytes : 0;
    return sum + Math.max(0, sizeBytes);
  }, 0);

  return (
    attachments.length > limits.maxAttachmentCountForPreview ||
    totalBytes > limits.maxAttachmentBytesForPreview
  );
}
