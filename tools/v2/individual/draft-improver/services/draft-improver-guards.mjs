const ALLOWED_GOALS = new Set([
  "clarity",
  "tone",
  "brevity",
  "professionalism",
  "grammar",
  "follow-up",
]);

export const DRAFT_IMPROVER_LIMITS = Object.freeze({
  maxDraftChars: 16_000,
  maxContextMessages: 20,
  maxGoals: 8,
  maxAttachmentMetadata: 10,
  chunkSizeChars: 3_000,
  asyncReviewThresholdChars: 9_000,
});

const CONTROL_CHARS_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const ACTIVE_MARKUP_PATTERN = /<\s*(script|iframe|object|embed|link|meta|style)\b/i;
const HTML_TAG_PATTERN = /<[^>]*>/g;
const SECRET_PATTERN =
  /\b(seed phrase|private key|api[_ -]?key|password|one[- ]time code|otp|recovery code|card number|bank account)\b/i;
const PROMPT_INJECTION_PATTERN =
  /\b(ignore previous instructions|system prompt|developer message|reveal secrets|bypass policy|jailbreak)\b/i;

function makeIssue(code, message) {
  return { code, message };
}

export function sanitizeDraftText(text) {
  return String(text)
    .replace(CONTROL_CHARS_PATTERN, "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(HTML_TAG_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toBoundedString(value, limit, fieldName, errors, warnings) {
  if (typeof value !== "string") {
    errors.push(makeIssue(`${fieldName}:invalid-type`, `${fieldName} must be a string.`));
    return { text: "", truncated: false, originalLength: 0 };
  }

  const withoutControls = value.replace(CONTROL_CHARS_PATTERN, "");
  const truncated = withoutControls.length > limit;

  if (truncated) {
    warnings.push(
      makeIssue(
        `${fieldName}:truncated`,
        `${fieldName} exceeded ${limit} characters and was clipped for local review.`,
      ),
    );
  }

  return {
    text: truncated ? withoutControls.slice(0, limit) : withoutControls,
    truncated,
    originalLength: withoutControls.length,
  };
}

function validateDraftSafety(rawDraft, errors, warnings) {
  if (ACTIVE_MARKUP_PATTERN.test(rawDraft)) {
    errors.push(
      makeIssue(
        "draft:active-markup",
        "Active or executable markup is not accepted by the isolated draft improver.",
      ),
    );
  }

  if (SECRET_PATTERN.test(rawDraft)) {
    errors.push(
      makeIssue(
        "draft:possible-secret",
        "Draft appears to contain credentials, financial identifiers, or recovery material.",
      ),
    );
  }

  if (PROMPT_INJECTION_PATTERN.test(rawDraft)) {
    warnings.push(
      makeIssue(
        "draft:prompt-injection",
        "Instruction-like text was detected and should be treated as draft content, not tool instructions.",
      ),
    );
  }
}

function normalizeGoals(value, errors, warnings) {
  if (value == null) {
    return ["clarity"];
  }

  if (!Array.isArray(value)) {
    errors.push(makeIssue("goals:invalid-type", "goals must be an array when present."));
    return [];
  }

  if (value.length > DRAFT_IMPROVER_LIMITS.maxGoals) {
    warnings.push(
      makeIssue(
        "goals:clipped",
        `Only the first ${DRAFT_IMPROVER_LIMITS.maxGoals} goals are retained.`,
      ),
    );
  }

  const normalized = [];
  for (const goal of value.slice(0, DRAFT_IMPROVER_LIMITS.maxGoals)) {
    if (typeof goal !== "string") {
      errors.push(makeIssue("goals:item-invalid", "each goal must be a string."));
      continue;
    }
    const normalizedGoal = goal.trim().toLowerCase();
    if (!ALLOWED_GOALS.has(normalizedGoal)) {
      errors.push(makeIssue("goals:unsupported", `${normalizedGoal} is not a supported goal.`));
      continue;
    }
    if (!normalized.includes(normalizedGoal)) {
      normalized.push(normalizedGoal);
    }
  }

  if (normalized.length === 0 && errors.length === 0) {
    errors.push(makeIssue("goals:empty", "at least one supported goal is required."));
  }

  return normalized;
}

function normalizeContextMessages(value, errors, warnings) {
  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    errors.push(
      makeIssue("contextMessages:invalid-type", "contextMessages must be an array when present."),
    );
    return [];
  }

  if (value.length > DRAFT_IMPROVER_LIMITS.maxContextMessages) {
    warnings.push(
      makeIssue(
        "contextMessages:clipped",
        `Only the latest ${DRAFT_IMPROVER_LIMITS.maxContextMessages} context messages are retained.`,
      ),
    );
  }

  return value.slice(-DRAFT_IMPROVER_LIMITS.maxContextMessages).map((message, index) => ({
    id: typeof message?.id === "string" ? message.id : `context-${index + 1}`,
    sender: typeof message?.sender === "string" && message.sender.endsWith(".test")
      ? message.sender
      : "synthetic@example.test",
    excerpt: sanitizeDraftText(message?.excerpt ?? "").slice(0, 500),
  }));
}

function summarizeAttachments(value, errors, warnings) {
  if (value == null) {
    return { count: 0, retainedMetadata: [] };
  }

  if (!Array.isArray(value)) {
    errors.push(makeIssue("attachments:invalid-type", "attachments must be an array when present."));
    return { count: 0, retainedMetadata: [] };
  }

  if (value.length > DRAFT_IMPROVER_LIMITS.maxAttachmentMetadata) {
    warnings.push(
      makeIssue(
        "attachments:metadata-clipped",
        `Only ${DRAFT_IMPROVER_LIMITS.maxAttachmentMetadata} attachment metadata entries are retained.`,
      ),
    );
  }

  return {
    count: value.length,
    retainedMetadata: value.slice(0, DRAFT_IMPROVER_LIMITS.maxAttachmentMetadata).map((item) => ({
      name: typeof item?.name === "string" ? item.name.slice(0, 120) : "unnamed",
      bytes: Number.isFinite(item?.bytes) && item.bytes >= 0 ? item.bytes : null,
    })),
  };
}

export function estimateDraftImprovementWorkload(draft, contextMessages) {
  const totalCharacters =
    draft.length + contextMessages.reduce((sum, message) => sum + message.excerpt.length, 0);

  return {
    totalCharacters,
    estimatedSegments: Math.max(
      1,
      Math.ceil(totalCharacters / DRAFT_IMPROVER_LIMITS.chunkSizeChars),
    ),
    recommendedMode:
      totalCharacters > DRAFT_IMPROVER_LIMITS.asyncReviewThresholdChars ? "async-review" : "inline",
  };
}

export function normalizeDraftImprovementRequest(input) {
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

  const boundedDraft = toBoundedString(
    input.draft,
    DRAFT_IMPROVER_LIMITS.maxDraftChars,
    "draft",
    errors,
    warnings,
  );

  if (!boundedDraft.text.trim()) {
    errors.push(makeIssue("draft:empty", "draft must contain text."));
  }

  validateDraftSafety(boundedDraft.text, errors, warnings);

  const draft = sanitizeDraftText(boundedDraft.text);
  const goals = normalizeGoals(input.goals, errors, warnings);
  const contextMessages = normalizeContextMessages(input.contextMessages, errors, warnings);
  const attachments = summarizeAttachments(input.attachments, errors, warnings);
  const performance = estimateDraftImprovementWorkload(draft, contextMessages);

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    request:
      errors.length === 0
        ? {
            id: typeof input.id === "string" && input.id ? input.id : "draft-improvement-request",
            draft,
            goals,
            contextMessages,
            attachments,
            draftTruncated: boundedDraft.truncated,
            performance,
          }
        : null,
  };
}
