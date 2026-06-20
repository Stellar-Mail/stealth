const SUPPORTED_LANGUAGE_CODES = new Set([
  "en",
  "es",
  "fr",
  "de",
  "it",
  "pt",
  "zh",
  "ja",
  "ko",
]);

export const TRANSLATION_LIMITS = Object.freeze({
  maxSubjectChars: 280,
  maxBodyChars: 20_000,
  maxRecipients: 50,
  maxAttachmentMetadata: 20,
  chunkSizeChars: 4_000,
  chunkedModeThresholdChars: 12_000,
});

const CONTROL_CHARS_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const UNSAFE_MARKUP_PATTERN = /<\s*(script|iframe|object|embed|link|meta|style)\b/i;
const HTML_TAG_PATTERN = /<[^>]*>/g;
const TRACKING_PIXEL_PATTERN = /<img[^>]+(?:width=["']?1|height=["']?1|tracking|pixel)/i;
const SECRET_PATTERN =
  /\b(seed phrase|private key|api[_ -]?key|password|one[- ]time code|otp|recovery code)\b/i;
const EXTERNAL_URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;

function makeIssue(code, message) {
  return { code, message };
}

function normalizeLanguageCode(value, fieldName, errors) {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(makeIssue(`${fieldName}:missing`, `${fieldName} is required.`));
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!SUPPORTED_LANGUAGE_CODES.has(normalized)) {
    errors.push(
      makeIssue(
        `${fieldName}:unsupported`,
        `${fieldName} must be one of: ${Array.from(SUPPORTED_LANGUAGE_CODES).join(", ")}.`,
      ),
    );
    return null;
  }

  return normalized;
}

function toBoundedString(value, limit, fieldName, errors, warnings) {
  if (value == null) {
    return { text: "", originalLength: 0, truncated: false };
  }

  if (typeof value !== "string") {
    errors.push(makeIssue(`${fieldName}:invalid-type`, `${fieldName} must be a string.`));
    return { text: "", originalLength: 0, truncated: false };
  }

  const withoutControls = value.replace(CONTROL_CHARS_PATTERN, "");
  const truncated = withoutControls.length > limit;
  if (truncated) {
    warnings.push(
      makeIssue(
        `${fieldName}:truncated`,
        `${fieldName} exceeded ${limit} characters and was clipped for local processing.`,
      ),
    );
  }

  return {
    text: truncated ? withoutControls.slice(0, limit) : withoutControls,
    originalLength: withoutControls.length,
    truncated,
  };
}

export function sanitizeTextForTranslation(text) {
  return String(text)
    .replace(CONTROL_CHARS_PATTERN, "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(HTML_TAG_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inspectUnsafeSignals(subject, body, errors, warnings) {
  const combined = `${subject}\n${body}`;

  if (UNSAFE_MARKUP_PATTERN.test(combined)) {
    errors.push(
      makeIssue(
        "content:active-markup",
        "Active or executable markup is not accepted by the isolated translator.",
      ),
    );
  }

  if (SECRET_PATTERN.test(combined)) {
    errors.push(
      makeIssue(
        "content:possible-secret",
        "Message appears to contain credentials, recovery codes, or other secrets.",
      ),
    );
  }

  if (TRACKING_PIXEL_PATTERN.test(combined)) {
    warnings.push(
      makeIssue(
        "content:tracking-pixel",
        "Tracking-pixel markup was detected and must not be fetched or rendered.",
      ),
    );
  }

  const externalUrls = combined.match(EXTERNAL_URL_PATTERN) ?? [];
  if (externalUrls.length > 0) {
    warnings.push(
      makeIssue(
        "content:external-urls",
        "External URLs are treated as inert text and must not be fetched by this tool.",
      ),
    );
  }
}

function normalizeRecipients(value, errors, warnings) {
  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    errors.push(makeIssue("recipients:invalid-type", "recipients must be an array when present."));
    return [];
  }

  if (value.length > TRANSLATION_LIMITS.maxRecipients) {
    warnings.push(
      makeIssue(
        "recipients:clipped",
        `Only the first ${TRANSLATION_LIMITS.maxRecipients} recipients are retained locally.`,
      ),
    );
  }

  return value
    .slice(0, TRANSLATION_LIMITS.maxRecipients)
    .filter((recipient) => typeof recipient === "string" && recipient.endsWith(".test"));
}

function summarizeAttachments(value, errors, warnings) {
  if (value == null) {
    return { count: 0, retainedMetadata: [] };
  }

  if (!Array.isArray(value)) {
    errors.push(makeIssue("attachments:invalid-type", "attachments must be an array when present."));
    return { count: 0, retainedMetadata: [] };
  }

  if (value.length > TRANSLATION_LIMITS.maxAttachmentMetadata) {
    warnings.push(
      makeIssue(
        "attachments:metadata-clipped",
        `Only ${TRANSLATION_LIMITS.maxAttachmentMetadata} attachment metadata entries are retained.`,
      ),
    );
  }

  return {
    count: value.length,
    retainedMetadata: value.slice(0, TRANSLATION_LIMITS.maxAttachmentMetadata).map((item) => ({
      name: typeof item?.name === "string" ? item.name.slice(0, 120) : "unnamed",
      bytes: Number.isFinite(item?.bytes) && item.bytes >= 0 ? item.bytes : null,
    })),
  };
}

export function estimateTranslationWorkload(subject, body) {
  const totalCharacters = subject.length + body.length;
  const estimatedSegments = Math.max(
    1,
    Math.ceil(totalCharacters / TRANSLATION_LIMITS.chunkSizeChars),
  );

  return {
    totalCharacters,
    estimatedSegments,
    recommendedMode:
      totalCharacters > TRANSLATION_LIMITS.chunkedModeThresholdChars ? "chunked" : "inline",
  };
}

export function normalizeEmailTranslationRequest(input) {
  const errors = [];
  const warnings = [];

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      ok: false,
      errors: [makeIssue("request:invalid-type", "request must be an object.")],
      warnings,
      request: null,
    };
  }

  const sourceLanguage = normalizeLanguageCode(input.sourceLanguage, "sourceLanguage", errors);
  const targetLanguage = normalizeLanguageCode(input.targetLanguage, "targetLanguage", errors);

  if (sourceLanguage && targetLanguage && sourceLanguage === targetLanguage) {
    errors.push(makeIssue("languages:same", "sourceLanguage and targetLanguage must differ."));
  }

  const subject = toBoundedString(
    input.subject,
    TRANSLATION_LIMITS.maxSubjectChars,
    "subject",
    errors,
    warnings,
  );
  const body = toBoundedString(
    input.body,
    TRANSLATION_LIMITS.maxBodyChars,
    "body",
    errors,
    warnings,
  );

  if (!subject.text.trim() && !body.text.trim()) {
    errors.push(makeIssue("content:empty", "subject or body must contain text."));
  }

  inspectUnsafeSignals(subject.text, body.text, errors, warnings);

  const sanitizedSubject = sanitizeTextForTranslation(subject.text);
  const sanitizedBody = sanitizeTextForTranslation(body.text);
  const recipients = normalizeRecipients(input.recipients, errors, warnings);
  const attachments = summarizeAttachments(input.attachments, errors, warnings);
  const performance = estimateTranslationWorkload(sanitizedSubject, sanitizedBody);

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    request:
      errors.length === 0
        ? {
            id: typeof input.id === "string" && input.id ? input.id : "email-translation-request",
            sourceLanguage,
            targetLanguage,
            subject: sanitizedSubject,
            body: sanitizedBody,
            recipients,
            attachments,
            bodyTruncated: body.truncated,
            subjectTruncated: subject.truncated,
            performance,
          }
        : null,
  };
}
