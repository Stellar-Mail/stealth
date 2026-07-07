const DEFAULT_TEXT_LIMIT = 12000;
const DEFAULT_ATTACHMENT_LIMIT = 25;
const DEFAULT_HISTORY_LIMIT = 50;

const CONTROL_CHARS_EXCEPT_TABS_AND_NEWLINES = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const SECRET_ASSIGNMENT =
  /\b(api[_-]?key|secret|token|password|private[_-]?key)\b\s*[:=]\s*([^\s,;]+)/gi;

export const REVIEW_SAFETY_LIMITS = Object.freeze({
  maxTextChars: DEFAULT_TEXT_LIMIT,
  maxAttachments: DEFAULT_ATTACHMENT_LIMIT,
  maxHistoryItems: DEFAULT_HISTORY_LIMIT,
});

export function sanitizeReviewText(value, options = {}) {
  const limit = Number.isInteger(options.limit) ? options.limit : DEFAULT_TEXT_LIMIT;
  const rawText = typeof value === "string" ? value : "";
  const withoutControls = rawText.replace(CONTROL_CHARS_EXCEPT_TABS_AND_NEWLINES, " ");
  let redactions = 0;
  const withoutSecrets = withoutControls.replace(SECRET_ASSIGNMENT, (_match, label) => {
    redactions += 1;
    return `${label}=[redacted]`;
  });

  const text = withoutSecrets.length > limit ? withoutSecrets.slice(0, limit) : withoutSecrets;

  return {
    text,
    originalLength: rawText.length,
    sanitizedLength: text.length,
    truncated: withoutSecrets.length > limit,
    redactions,
  };
}

export function normalizeAttachmentList(attachments, options = {}) {
  const limit = Number.isInteger(options.limit) ? options.limit : DEFAULT_ATTACHMENT_LIMIT;
  const source = Array.isArray(attachments) ? attachments : [];
  const normalized = source.slice(0, limit).map((attachment, index) => ({
    id: String(attachment?.id || `attachment-${index + 1}`),
    name: sanitizeReviewText(attachment?.name, { limit: 160 }).text || "unnamed-attachment",
    sizeBytes: Math.max(0, Number(attachment?.sizeBytes) || 0),
    mimeType:
      sanitizeReviewText(attachment?.mimeType, { limit: 120 }).text || "application/octet-stream",
  }));

  return {
    attachments: normalized,
    originalCount: source.length,
    truncated: source.length > limit,
  };
}

export function normalizeHistoryItems(history, options = {}) {
  const limit = Number.isInteger(options.limit) ? options.limit : DEFAULT_HISTORY_LIMIT;
  const source = Array.isArray(history) ? history : [];
  const items = source.slice(0, limit).map((item, index) => ({
    id: String(item?.id || `history-${index + 1}`),
    action: sanitizeReviewText(item?.action, { limit: 120 }).text || "unknown",
    actor: sanitizeReviewText(item?.actor, { limit: 120 }).text || "unknown",
    occurredAt: sanitizeReviewText(item?.occurredAt, { limit: 80 }).text || "",
  }));

  return {
    history: items,
    originalCount: source.length,
    truncated: source.length > limit,
  };
}

export function evaluateLegalReviewInput(input, options = {}) {
  const errors = [];
  const warnings = [];

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      ok: false,
      errors: ["input-must-be-object"],
      warnings,
      sanitized: null,
      performance: {
        skipped: true,
        reason: "invalid-input",
      },
    };
  }

  const subject = sanitizeReviewText(input.subject, { limit: 240 });
  const body = sanitizeReviewText(input.body, {
    limit: options.maxTextChars || DEFAULT_TEXT_LIMIT,
  });
  const attachments = normalizeAttachmentList(input.attachments, {
    limit: options.maxAttachments || DEFAULT_ATTACHMENT_LIMIT,
  });
  const history = normalizeHistoryItems(input.history, {
    limit: options.maxHistoryItems || DEFAULT_HISTORY_LIMIT,
  });

  if (!subject.text) {
    errors.push("subject-required");
  }

  if (!body.text) {
    errors.push("body-required");
  }

  if (body.truncated) {
    warnings.push("body-truncated");
  }

  if (body.redactions > 0 || subject.redactions > 0) {
    warnings.push("secret-like-values-redacted");
  }

  if (attachments.truncated) {
    warnings.push("attachments-truncated");
  }

  if (history.truncated) {
    warnings.push("history-truncated");
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    sanitized: {
      subject: subject.text,
      body: body.text,
      attachments: attachments.attachments,
      history: history.history,
    },
    performance: {
      bodyChars: body.sanitizedLength,
      originalBodyChars: body.originalLength,
      attachmentCount: attachments.attachments.length,
      originalAttachmentCount: attachments.originalCount,
      historyCount: history.history.length,
      originalHistoryCount: history.originalCount,
    },
  };
}
