const DEFAULT_LIMITS = Object.freeze({
  maxSubjectLength: 160,
  maxBodyLength: 4000,
  maxQueueLength: 80,
  maxAssigneeLength: 80,
  maxRecipientCount: 25,
  maxAttachmentCount: 8,
  maxAttachmentBytes: 10 * 1024 * 1024,
  maxHistoryEvents: 40,
  maxTeamCandidates: 25,
  maxBatchSize: 50,
});

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const RISKY_ATTACHMENT_EXTENSION = /\.(bat|cmd|com|exe|js|jse|msi|ps1|scr|vbs|wsf)$/i;
const SCRIPT_PATTERN = /<\s*\/?\s*script\b|javascript\s*:/i;
const TRACKING_PIXEL_PATTERN = /<img\b[^>]*(width|height)\s*=\s*["']?1["']?/i;
const TOKEN_PATTERN = /\b(api[_-]?key|bearer|secret|token|password)\b\s*[:=]/i;
const CONTROL_OR_BIDI_PATTERN = /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g;

function mergeLimits(options = {}) {
  return {
    ...DEFAULT_LIMITS,
    ...(options.limits || {}),
  };
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function sanitizeText(value, maxLength) {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value
    .replace(CONTROL_OR_BIDI_PATTERN, " ")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length > maxLength) {
    return normalized.slice(0, maxLength).trimEnd();
  }

  return normalized;
}

function sanitizeEmail(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toLowerCase();
}

function normalizeStringList(values, maxCount, maxLength, warnings, warningPrefix) {
  if (!Array.isArray(values)) {
    return [];
  }

  if (values.length > maxCount) {
    warnings.push(`${warningPrefix}_truncated`);
  }

  return values
    .slice(0, maxCount)
    .map((value) => sanitizeText(value, maxLength))
    .filter(Boolean);
}

function detectContentWarnings(rawSubject, rawBody) {
  const combined = `${typeof rawSubject === "string" ? rawSubject : ""}\n${
    typeof rawBody === "string" ? rawBody : ""
  }`;
  const warnings = [];

  if (SCRIPT_PATTERN.test(combined)) {
    warnings.push("active_content_removed");
  }

  if (TRACKING_PIXEL_PATTERN.test(combined)) {
    warnings.push("tracking_pixel_hint");
  }

  if (TOKEN_PATTERN.test(combined)) {
    warnings.push("secret_like_text_detected");
  }

  return warnings;
}

function sanitizeAttachmentMetadata(attachments, limits, warnings) {
  if (!Array.isArray(attachments)) {
    return [];
  }

  if (attachments.length > limits.maxAttachmentCount) {
    warnings.push("attachments_truncated");
  }

  return attachments.slice(0, limits.maxAttachmentCount).map((attachment, index) => {
    const fileName = sanitizeText(attachment?.fileName, 160) || `attachment-${index + 1}`;
    const contentType = sanitizeText(attachment?.contentType, 120) || "application/octet-stream";
    const byteSize = Number.isFinite(attachment?.byteSize)
      ? Math.max(0, Math.floor(attachment.byteSize))
      : 0;
    const flags = [];

    if (RISKY_ATTACHMENT_EXTENSION.test(fileName)) {
      flags.push("risky_extension");
      warnings.push("risky_attachment_extension");
    }

    if (byteSize > limits.maxAttachmentBytes) {
      flags.push("oversized_attachment");
      warnings.push("oversized_attachment");
    }

    return {
      fileName,
      contentType,
      byteSize: Math.min(byteSize, limits.maxAttachmentBytes),
      flags,
    };
  });
}

function sanitizeHistoryEvents(events, limits, warnings) {
  if (!Array.isArray(events)) {
    return [];
  }

  if (events.length > limits.maxHistoryEvents) {
    warnings.push("history_truncated");
  }

  return events.slice(0, limits.maxHistoryEvents).map((event) => ({
    actor: sanitizeText(event?.actor, 80) || "unknown",
    action: sanitizeText(event?.action, 80) || "noted",
    at: sanitizeText(event?.at, 40),
  }));
}

function rejectIfMissingRequiredFields(input, errors) {
  if (!hasText(input?.subject)) {
    errors.push("missing_subject");
  }

  if (!hasText(input?.body)) {
    errors.push("missing_body");
  }

  if (!EMAIL_PATTERN.test(sanitizeEmail(input?.sender))) {
    errors.push("invalid_sender");
  }
}

export function sanitizeMailTicketDraft(input, options = {}) {
  const limits = mergeLimits(options);
  const errors = [];
  const warnings = [];

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      ok: false,
      errors: ["invalid_input"],
      warnings,
    };
  }

  rejectIfMissingRequiredFields(input, errors);
  warnings.push(...detectContentWarnings(input.subject, input.body));

  const subjectWasLong =
    typeof input.subject === "string" && input.subject.length > limits.maxSubjectLength;
  const bodyWasLong = typeof input.body === "string" && input.body.length > limits.maxBodyLength;

  if (subjectWasLong) {
    warnings.push("subject_truncated");
  }

  if (bodyWasLong) {
    warnings.push("body_truncated");
  }

  const sender = sanitizeEmail(input.sender);
  const recipients = normalizeStringList(
    input.recipients,
    limits.maxRecipientCount,
    120,
    warnings,
    "recipients",
  );
  const attachments = sanitizeAttachmentMetadata(input.attachments, limits, warnings);
  const history = sanitizeHistoryEvents(input.history, limits, warnings);
  const teamCandidates = normalizeStringList(
    input.teamCandidates,
    limits.maxTeamCandidates,
    limits.maxAssigneeLength,
    warnings,
    "team_candidates",
  );

  const value = {
    id: sanitizeText(input.id, 80),
    subject: sanitizeText(input.subject, limits.maxSubjectLength),
    body: sanitizeText(input.body, limits.maxBodyLength),
    sender,
    recipients,
    queue: sanitizeText(input.queue, limits.maxQueueLength) || "support",
    requestedAssignee: sanitizeText(input.requestedAssignee, limits.maxAssigneeLength),
    attachments,
    history,
    teamCandidates,
  };

  return {
    ok: errors.length === 0,
    errors,
    warnings: [...new Set(warnings)],
    value: errors.length === 0 ? value : undefined,
  };
}

export function createMailTicketBatchPlan(items, options = {}) {
  const limits = mergeLimits(options);
  const source = Array.isArray(items) ? items : [];
  const processLimit = Math.max(1, Math.floor(limits.maxBatchSize));
  const selected = source.slice(0, processLimit);

  return {
    items: selected,
    processLimit,
    sourceCount: source.length,
    skippedCount: Math.max(0, source.length - selected.length),
    truncated: source.length > selected.length,
  };
}

export function guardMailTicketBatch(items, options = {}) {
  const plan = createMailTicketBatchPlan(items, options);
  const accepted = [];
  const rejected = [];

  for (const item of plan.items) {
    const result = sanitizeMailTicketDraft(item, options);
    if (result.ok) {
      accepted.push(result);
    } else {
      rejected.push(result);
    }
  }

  return {
    accepted,
    rejected,
    plan,
  };
}

export const mailTicketGuardDefaults = DEFAULT_LIMITS;
