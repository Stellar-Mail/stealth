const SUPPORTED_GOALS = new Set([
  "clarity",
  "concise",
  "friendly",
  "professional",
  "call-to-action",
]);

const DEFAULT_LIMITS = {
  maxSubjectChars: 120,
  maxBodyChars: 4000,
  maxContextChars: 800,
};

const FILLER_REPLACEMENTS = [
  [/\bjust wanted to\b/gi, "wanted to"],
  [/\bi think maybe\b/gi, "I recommend"],
  [/\bkind of\b/gi, ""],
  [/\bsort of\b/gi, ""],
  [/\bas soon as possible\b/gi, "by the requested date"],
  [/\bat your earliest convenience\b/gi, "when you have a moment"],
  [/\bcircle back\b/gi, "follow up"],
];

const CASUAL_REPLACEMENTS = [
  [/\bhey\b/gi, "Hi"],
  [/\bthx\b/gi, "Thank you"],
  [/\bu\b/g, "you"],
  [/\bur\b/g, "your"],
];

const ISSUE_CHECKS = [
  {
    code: "empty-subject",
    severity: "medium",
    test: (request) => request.subject.length === 0,
    message: "Subject is empty, so reviewers need a generated subject suggestion.",
  },
  {
    code: "long-paragraph",
    severity: "low",
    test: (request) => request.body.split(/\n{2,}/).some((part) => countWords(part) > 70),
    message: "One or more paragraphs are long enough to reduce scanability.",
  },
  {
    code: "missing-call-to-action",
    severity: "medium",
    test: (request) => !hasCallToAction(request.body),
    message: "Draft does not contain a clear next action.",
  },
  {
    code: "filler-language",
    severity: "low",
    test: (request) =>
      FILLER_REPLACEMENTS.some(([pattern]) => {
        pattern.lastIndex = 0;
        return pattern.test(request.body);
      }),
    message: "Draft contains filler wording that can be tightened.",
  },
];

function countWords(value) {
  const matches = String(value)
    .trim()
    .match(/[A-Za-z0-9']+/g);
  return matches ? matches.length : 0;
}

function clipText(value, limit) {
  const text = String(value ?? "");
  if (text.length <= limit) {
    return {
      text,
      clipped: false,
    };
  }

  return {
    text: text.slice(0, limit).trimEnd(),
    clipped: true,
  };
}

function normalizeWhitespace(value) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((part) => part.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
}

function normalizeGoal(goal) {
  const normalized = String(goal ?? "clarity")
    .trim()
    .toLowerCase();
  return SUPPORTED_GOALS.has(normalized) ? normalized : "clarity";
}

function titleCase(value) {
  return String(value ?? "")
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function firstName(value) {
  const name = String(value ?? "").trim();
  if (!name) {
    return "";
  }
  return name.split(/\s+/)[0].replace(/[^A-Za-z'-]/g, "");
}

function hasGreeting(body) {
  return /^(hi|hello|dear|good morning|good afternoon|good evening)\b/i.test(body.trim());
}

function hasSignoff(body) {
  return /\n\s*(best|thanks|thank you|regards|sincerely),?\s*\n?/i.test(body);
}

function hasCallToAction(body) {
  return /\b(please|could you|can you|reply|confirm|review|let me know)\b/i.test(body);
}

function sentenceCase(value) {
  const text = String(value ?? "").trim();
  if (!text) {
    return "";
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function buildSubject(request) {
  if (request.subject) {
    return request.subject;
  }

  const words = request.body
    .replace(/[^A-Za-z0-9' ]+/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .slice(0, 7);

  if (request.goal === "call-to-action") {
    return `Action requested: ${titleCase(words.join(" ")) || "Draft Follow Up"}`;
  }

  return `Draft: ${titleCase(words.join(" ")) || "Follow Up"}`;
}

function applyPhraseReplacements(body, replacements) {
  let updated = body;
  const changes = [];

  for (const [pattern, replacement] of replacements) {
    const before = updated;
    updated = updated.replace(pattern, replacement);
    updated = updated.replace(/[ \t]{2,}/g, " ");

    if (updated !== before) {
      changes.push({
        type: "wording",
        label: `Replaced ${pattern.source}`,
      });
    }
  }

  return {
    body: updated,
    changes,
  };
}

function splitLongParagraphs(body) {
  const paragraphs = body.split(/\n{2,}/);
  let changed = false;

  const updated = paragraphs.map((paragraph) => {
    if (countWords(paragraph) <= 70) {
      return paragraph;
    }

    const sentences = paragraph.match(/[^.!?]+[.!?]?/g) ?? [paragraph];
    if (sentences.length < 2) {
      return paragraph;
    }

    changed = true;
    const midpoint = Math.ceil(sentences.length / 2);
    return `${sentences.slice(0, midpoint).join("").trim()}\n\n${sentences
      .slice(midpoint)
      .join("")
      .trim()}`;
  });

  return {
    body: updated.join("\n\n"),
    changed,
  };
}

function addGreeting(body, audience) {
  if (hasGreeting(body)) {
    return {
      body,
      changed: false,
    };
  }

  const recipient = firstName(audience);
  const greeting = recipient ? `Hi ${recipient},` : "Hi,";
  return {
    body: `${greeting}\n\n${body}`,
    changed: true,
  };
}

function addSignoff(body, senderName) {
  if (!senderName || hasSignoff(body)) {
    return {
      body,
      changed: false,
    };
  }

  return {
    body: `${body}\n\nBest,\n${senderName}`,
    changed: true,
  };
}

function addCallToAction(body, request) {
  if (hasCallToAction(body)) {
    return {
      body,
      changed: false,
    };
  }

  const deadline = request.deadline ? ` by ${request.deadline}` : "";
  const action = `Please reply with the next step${deadline}.`;
  return {
    body: `${body}\n\n${action}`,
    changed: true,
  };
}

function buildIssues(request) {
  return ISSUE_CHECKS.filter((check) => check.test(request)).map((check) => ({
    code: check.code,
    severity: check.severity,
    message: check.message,
  }));
}

function buildPreview(body) {
  const compact = body.replace(/\s+/g, " ").trim();
  return compact.length > 180 ? `${compact.slice(0, 177)}...` : compact;
}

function buildMetrics(originalBody, improvedBody, issues) {
  const originalWordCount = countWords(originalBody);
  const improvedWordCount = countWords(improvedBody);
  const reductionPercent =
    originalWordCount === 0
      ? 0
      : Math.round(((originalWordCount - improvedWordCount) / originalWordCount) * 100);

  return {
    originalWordCount,
    improvedWordCount,
    reductionPercent,
    readingTimeMinutes: Math.max(1, Math.ceil(improvedWordCount / 225)),
    issueCount: issues.length,
  };
}

function normalizeRequest(request, limits) {
  const subject = clipText(normalizeWhitespace(request?.subject), limits.maxSubjectChars);
  const body = clipText(normalizeWhitespace(request?.body), limits.maxBodyChars);
  const context = clipText(normalizeWhitespace(request?.context), limits.maxContextChars);

  return {
    id: String(request?.id ?? "draft-request").trim() || "draft-request",
    subject: subject.text,
    body: body.text,
    goal: normalizeGoal(request?.goal),
    audience: normalizeWhitespace(request?.audience),
    senderName: normalizeWhitespace(request?.senderName),
    deadline: normalizeWhitespace(request?.deadline),
    context: context.text,
    channel: normalizeWhitespace(request?.channel) || "email",
    clipped: {
      subject: subject.clipped,
      body: body.clipped,
      context: context.clipped,
    },
  };
}

export function validateDraftImproverRequest(request, options = {}) {
  const limits = {
    ...DEFAULT_LIMITS,
    ...options.limits,
  };
  const errors = [];

  if (!request || typeof request !== "object") {
    errors.push({
      code: "invalid-request",
      message: "Request must be an object.",
    });
    return {
      valid: false,
      errors,
    };
  }

  const body = String(request.body ?? "").trim();
  if (!body) {
    errors.push({
      code: "empty-body",
      message: "Draft body is required.",
    });
  }

  if (/<script\b|javascript:/i.test(body)) {
    errors.push({
      code: "active-content",
      message: "Draft body contains active markup and must be reviewed before improvement.",
    });
  }

  if (String(request.subject ?? "").length > limits.maxSubjectChars * 2) {
    errors.push({
      code: "subject-too-long",
      message: "Subject is too long for the local Draft Improver contract.",
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function createDraftImproverLoadingState(message = "Improving draft") {
  return {
    status: "loading",
    isLoading: true,
    error: null,
    result: null,
    message,
  };
}

export function createDraftImproverErrorState(errors, requestId = null) {
  const normalizedErrors = Array.isArray(errors) ? errors : [errors];

  return {
    status: "error",
    isLoading: false,
    error: {
      code: "draft-improver-error",
      messages: normalizedErrors.map((error) =>
        typeof error === "string" ? error : error.message || "Unknown draft improver error",
      ),
    },
    result: null,
    requestId,
  };
}

export function improveDraft(request, options = {}) {
  const validation = validateDraftImproverRequest(request, options);
  if (!validation.valid) {
    return createDraftImproverErrorState(validation.errors, request?.id ?? null);
  }

  const generatedAt = options.now ?? "2026-07-01T00:00:00.000Z";
  const limits = {
    ...DEFAULT_LIMITS,
    ...options.limits,
  };
  const normalized = normalizeRequest(request, limits);
  const originalBody = normalized.body;
  const originalIssues = buildIssues(normalized);
  const changes = [];
  const warnings = [];
  let improvedBody = normalized.body;
  let improvedSubject = buildSubject(normalized);

  if (improvedSubject !== normalized.subject) {
    changes.push({
      type: "subject",
      label: "Generated a reviewable subject line",
      before: normalized.subject,
      after: improvedSubject,
    });
  }

  for (const [key, clipped] of Object.entries(normalized.clipped)) {
    if (clipped) {
      warnings.push({
        code: `${key}-clipped`,
        message: `${key} was clipped to stay within the local review limit.`,
      });
    }
  }

  const fillerResult = applyPhraseReplacements(improvedBody, FILLER_REPLACEMENTS);
  improvedBody = fillerResult.body;
  changes.push(...fillerResult.changes);

  if (normalized.goal === "professional") {
    const professionalResult = applyPhraseReplacements(improvedBody, CASUAL_REPLACEMENTS);
    improvedBody = professionalResult.body;
    changes.push(...professionalResult.changes);
  }

  if (normalized.goal === "concise") {
    const before = improvedBody;
    improvedBody = improvedBody
      .replace(/\bvery\s+/gi, "")
      .replace(/\breally\s+/gi, "")
      .replace(/\bin order to\b/gi, "to")
      .replace(/[ \t]{2,}/g, " ");

    if (improvedBody !== before) {
      changes.push({
        type: "concise",
        label: "Removed low-value intensifiers",
      });
    }
  }

  if (normalized.goal === "friendly") {
    const before = improvedBody;
    improvedBody = improvedBody.replace(/\bPlease send\b/g, "Could you send");
    if (improvedBody !== before) {
      changes.push({
        type: "tone",
        label: "Softened a direct request",
      });
    }
  }

  const paragraphResult = splitLongParagraphs(improvedBody);
  improvedBody = paragraphResult.body;
  if (paragraphResult.changed) {
    changes.push({
      type: "structure",
      label: "Split long paragraphs for reviewability",
    });
  }

  const greetingResult = addGreeting(improvedBody, normalized.audience);
  improvedBody = greetingResult.body;
  if (greetingResult.changed) {
    changes.push({
      type: "structure",
      label: "Added a greeting",
    });
  }

  const callToActionResult = addCallToAction(improvedBody, normalized);
  improvedBody = callToActionResult.body;
  if (callToActionResult.changed) {
    changes.push({
      type: "action",
      label: "Added a clear next action",
    });
  }

  const signoffResult = addSignoff(improvedBody, normalized.senderName);
  improvedBody = signoffResult.body;
  if (signoffResult.changed) {
    changes.push({
      type: "structure",
      label: "Added a sender signoff",
    });
  }

  improvedBody = sentenceCase(improvedBody);
  const remainingIssues = buildIssues({
    ...normalized,
    subject: improvedSubject,
    body: improvedBody,
  });
  const metrics = buildMetrics(originalBody, improvedBody, originalIssues);
  const reviewRequired = remainingIssues.some((issue) => issue.severity === "medium");

  return {
    status: "ready",
    isLoading: false,
    error: null,
    result: {
      id: normalized.id,
      status: reviewRequired ? "needs-review" : "improved",
      generatedAt,
      input: {
        subject: normalized.subject,
        body: originalBody,
        goal: normalized.goal,
        audience: normalized.audience,
        senderName: normalized.senderName,
        deadline: normalized.deadline,
        context: normalized.context,
        channel: normalized.channel,
      },
      output: {
        subject: improvedSubject,
        body: improvedBody,
        preview: buildPreview(improvedBody),
      },
      issues: originalIssues,
      remainingIssues,
      changes,
      warnings,
      metrics,
      reviewRequired,
    },
  };
}

export function improveDraftBatch(requests, options = {}) {
  const sourceRequests = Array.isArray(requests) ? requests : [];
  const results = sourceRequests.map((request) => improveDraft(request, options));
  const readyResults = results.filter((response) => response.status === "ready");

  return {
    status: results.some((response) => response.status === "error") ? "needs-review" : "ready",
    totalRequests: sourceRequests.length,
    improved: readyResults.filter((response) => response.result.status === "improved").length,
    needsReview: readyResults.filter((response) => response.result.status === "needs-review")
      .length,
    errors: results.filter((response) => response.status === "error").length,
    responses: results,
  };
}

export const draftImproverCore = {
  improveDraft,
  improveDraftBatch,
  validateDraftImproverRequest,
  createDraftImproverLoadingState,
  createDraftImproverErrorState,
};
