const CONTROL_CHARS_EXCEPT_WHITESPACE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const SCRIPT_OR_STYLE_BLOCK = /<(script|style)\b[\s\S]*?<\/\1>/gi;
const HTML_TAG = /<[^>]+>/g;
const WHITESPACE = /\s+/g;
const SECRET_ASSIGNMENT =
  /\b(password|passcode|api[_ -]?key|access[_ -]?token|refresh[_ -]?token|secret)\s*[:=]\s*([^\s,;]+)/gi;
const BEARER_TOKEN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/g;
const EMAIL_ADDRESS = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export const DEFAULT_LIMITS = Object.freeze({
  maxSubjectChars: 160,
  maxBodyChars: 12000,
  maxAttachmentCount: 8,
  maxAttachmentBytes: 10 * 1024 * 1024,
  maxTotalAttachmentBytes: 25 * 1024 * 1024,
  maxThreadItems: 50,
});

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asString(value) {
  return typeof value === "string" ? value : "";
}

export function sanitizeText(value, maxChars = DEFAULT_LIMITS.maxBodyChars) {
  const raw = asString(value);
  const redacted = raw
    .replace(SCRIPT_OR_STYLE_BLOCK, " ")
    .replace(HTML_TAG, " ")
    .replace(CONTROL_CHARS_EXCEPT_WHITESPACE, " ")
    .replace(SECRET_ASSIGNMENT, "$1=[REDACTED]")
    .replace(BEARER_TOKEN, "Bearer [REDACTED]")
    .replace(WHITESPACE, " ")
    .trim();

  if (redacted.length <= maxChars) {
    return { value: redacted, truncated: false, rawLength: raw.length };
  }

  return {
    value: redacted.slice(0, Math.max(0, maxChars - 3)).trimEnd() + "...",
    truncated: true,
    rawLength: raw.length,
  };
}

export function validateMailEnvelope(raw) {
  const errors = [];

  if (!isPlainObject(raw)) {
    return ["mail must be an object"];
  }

  if (!asString(raw.id).trim()) errors.push("id is required");
  if (!EMAIL_ADDRESS.test(asString(raw.from).trim())) errors.push("from must be an email address");
  if (!asString(raw.subject).trim()) errors.push("subject is required");
  if (!asString(raw.body).trim()) errors.push("body is required");
  if (raw.attachments !== undefined && !Array.isArray(raw.attachments)) {
    errors.push("attachments must be an array when provided");
  }
  if (raw.thread !== undefined && !Array.isArray(raw.thread)) {
    errors.push("thread must be an array when provided");
  }

  return errors;
}

export function evaluateProcessingBudget(raw, limits = DEFAULT_LIMITS) {
  const attachments = Array.isArray(raw?.attachments) ? raw.attachments : [];
  const thread = Array.isArray(raw?.thread) ? raw.thread : [];
  const bodyChars = asString(raw?.body).length;
  const totalAttachmentBytes = attachments.reduce((sum, attachment) => {
    const size = Number(attachment?.sizeBytes);
    return Number.isFinite(size) && size > 0 ? sum + size : sum;
  }, 0);
  const warnings = [];

  if (bodyChars > limits.maxBodyChars) warnings.push("body-truncated");
  if (attachments.length > limits.maxAttachmentCount) warnings.push("attachment-count-capped");
  if (totalAttachmentBytes > limits.maxTotalAttachmentBytes) {
    warnings.push("attachment-total-size-exceeded");
  }
  if (
    attachments.some((attachment) => {
      const size = Number(attachment?.sizeBytes);
      return Number.isFinite(size) && size > limits.maxAttachmentBytes;
    })
  ) {
    warnings.push("large-attachment-skipped");
  }
  if (thread.length > limits.maxThreadItems) warnings.push("thread-capped");

  return {
    bodyChars,
    attachmentCount: attachments.length,
    totalAttachmentBytes,
    threadItems: thread.length,
    safeAttachmentLimit: Math.min(attachments.length, limits.maxAttachmentCount),
    safeThreadLimit: Math.min(thread.length, limits.maxThreadItems),
    warnings,
  };
}

export function normalizeAttachment(attachment, limits = DEFAULT_LIMITS) {
  const filename = sanitizeText(attachment?.filename ?? "unnamed", 120).value || "unnamed";
  const contentType = sanitizeText(attachment?.contentType ?? "application/octet-stream", 120).value;
  const sizeBytes = Number(attachment?.sizeBytes);
  const safeSizeBytes = Number.isFinite(sizeBytes) && sizeBytes > 0 ? sizeBytes : 0;

  return {
    filename,
    contentType,
    sizeBytes: safeSizeBytes,
    skipped: safeSizeBytes > limits.maxAttachmentBytes,
  };
}

export function normalizeTicketCandidate(raw, limits = DEFAULT_LIMITS) {
  const errors = validateMailEnvelope(raw);
  if (errors.length > 0) {
    return { ok: false, errors, warnings: [], ticket: null };
  }

  const budget = evaluateProcessingBudget(raw, limits);
  const subject = sanitizeText(raw.subject, limits.maxSubjectChars);
  const body = sanitizeText(raw.body, limits.maxBodyChars);
  const rawAttachments = Array.isArray(raw.attachments) ? raw.attachments : [];
  const rawThread = Array.isArray(raw.thread) ? raw.thread : [];
  const attachments = rawAttachments
    .slice(0, limits.maxAttachmentCount)
    .map((attachment) => normalizeAttachment(attachment, limits));
  const threadPreview = rawThread.slice(0, limits.maxThreadItems).map((item) => ({
    from: sanitizeText(item?.from ?? "unknown", 120).value,
    body: sanitizeText(item?.body ?? "", 500).value,
  }));
  const warnings = [...budget.warnings];

  if (subject.truncated) warnings.push("subject-truncated");
  if (body.truncated && !warnings.includes("body-truncated")) warnings.push("body-truncated");
  if (attachments.some((attachment) => attachment.skipped) && !warnings.includes("large-attachment-skipped")) {
    warnings.push("large-attachment-skipped");
  }

  return {
    ok: true,
    errors: [],
    warnings: [...new Set(warnings)],
    budget,
    ticket: {
      sourceMailId: sanitizeText(raw.id, 120).value,
      requester: sanitizeText(raw.from, 254).value.toLowerCase(),
      title: subject.value,
      description: body.value,
      receivedAt: asString(raw.receivedAt).trim() || null,
      attachments,
      threadPreview,
    },
  };
}
