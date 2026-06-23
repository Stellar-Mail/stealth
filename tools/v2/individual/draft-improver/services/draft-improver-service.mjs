const VALID_TONES = new Set(["neutral", "warm", "formal", "concise"]);
const VALID_CHANNELS = new Set(["email", "reply", "follow-up"]);
const VALID_AUDIENCES = new Set(["general", "customer", "manager", "peer", "recruiter"]);

const HARSH_PHRASES = [
  {
    pattern: /\bASAP\b/gi,
    replacement: "when you have a chance",
    label: "Replace ASAP with a calmer timeline.",
  },
  {
    pattern: /\bper my last email\b/gi,
    replacement: "following up on my earlier note",
    label: "Replace confrontational follow-up phrasing.",
  },
  {
    pattern: /\bobviously\b/gi,
    replacement: "it looks like",
    label: "Soften language that can read as dismissive.",
  },
  {
    pattern: /\bjust checking in\b/gi,
    replacement: "following up",
    label: "Use a more direct follow-up phrase.",
  },
];

const CTA_PATTERNS = [
  /\bplease\b/i,
  /\bcould you\b/i,
  /\bcan you\b/i,
  /\blet me know\b/i,
  /\bconfirm\b/i,
  /\breview\b/i,
  /\bapprove\b/i,
  /\bsend\b/i,
  /\bshare\b/i,
];

const SENSITIVE_PATTERNS = [
  /\bpassword\b/i,
  /\bapi[_ -]?key\b/i,
  /\bsecret\b/i,
  /\bssn\b/i,
  /\bsocial security\b/i,
  /\bcredit card\b/i,
  /\bbank account\b/i,
  /\brouting number\b/i,
];

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeWhitespace(value) {
  return cleanText(value)
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim().replace(/[ \t]+/g, " "))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function countWords(value) {
  const words = normalizeWhitespace(value).match(/[A-Za-z0-9']+/g);
  return words ? words.length : 0;
}

function splitSentences(value) {
  return normalizeWhitespace(value)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function hasGreeting(value) {
  return /^(hi|hello|dear|good morning|good afternoon|hey)\b/i.test(normalizeWhitespace(value));
}

function hasSignoff(value) {
  const lines = normalizeWhitespace(value)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const lastTwoLines = lines.slice(-2).join(" ");
  return /\b(thanks|thank you|best|regards|sincerely)\b/i.test(lastTwoLines);
}

function hasCallToAction(value) {
  return CTA_PATTERNS.some((pattern) => pattern.test(value));
}

function containsSensitiveText(value) {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(value));
}

function containsHarshPhrase(value) {
  return HARSH_PHRASES.some(({ pattern }) => {
    pattern.lastIndex = 0;
    const matched = pattern.test(value);
    pattern.lastIndex = 0;
    return matched;
  });
}

function countShoutingWords(value) {
  const matches = value.match(/\b[A-Z]{4,}\b/g);
  return matches ? matches.length : 0;
}

function normalizeEnum(value, allowed, fallback) {
  const normalized = cleanText(value).toLowerCase();
  return allowed.has(normalized) ? normalized : fallback;
}

function titleCase(value) {
  const cleaned = value.toLowerCase();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function trimSentence(value, maxLength = 72) {
  const cleaned = normalizeWhitespace(value)
    .replace(/^(hi|hello|dear|hey)\s+[^,\n]+,?\s*/i, "")
    .replace(/[.!?]+$/g, "")
    .trim();

  if (cleaned.length <= maxLength) {
    return titleCase(cleaned);
  }

  const shortened = cleaned.slice(0, maxLength - 1).replace(/\s+\S*$/, "");
  return `${titleCase(shortened)}...`;
}

function makeIssue(id, severity, message, suggestion) {
  return { id, severity, message, suggestion };
}

export function normalizeDraftInput(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("Draft input must be an object.");
  }

  return {
    id: cleanText(input.id) || "draft-local",
    subject: cleanText(input.subject),
    body: normalizeWhitespace(input.body),
    recipientName: cleanText(input.recipientName),
    senderName: cleanText(input.senderName),
    tone: normalizeEnum(input.tone, VALID_TONES, "neutral"),
    channel: normalizeEnum(input.channel, VALID_CHANNELS, "email"),
    audience: normalizeEnum(input.audience, VALID_AUDIENCES, "general"),
  };
}

export function suggestSubjectLine(body, fallback = "Draft follow-up") {
  const firstSentence = splitSentences(body)[0];
  if (!firstSentence) {
    return fallback;
  }
  return trimSentence(firstSentence);
}

export function analyzeDraft(input) {
  const draft = normalizeDraftInput(input);
  const body = draft.body;
  const wordCount = countWords(body);
  const sentenceCount = splitSentences(body).length;
  const issues = [];

  if (!body) {
    issues.push(
      makeIssue(
        "missing-body",
        "blocking",
        "Draft body is empty.",
        "Add the message body before reviewing the draft.",
      ),
    );
  }

  if (containsSensitiveText(body)) {
    issues.push(
      makeIssue(
        "sensitive-data",
        "blocking",
        "Draft may contain sensitive credentials or payment data.",
        "Remove secrets, card data, bank details, or government identifiers before sending.",
      ),
    );
  }

  if (body && wordCount < 12) {
    issues.push(
      makeIssue(
        "too-short",
        "warning",
        "Draft may be too short to give enough context.",
        "Add the reason for the message and the action you need.",
      ),
    );
  }

  if (wordCount > 180) {
    issues.push(
      makeIssue(
        "too-long",
        "warning",
        "Draft may be too long for a quick email.",
        "Shorten background details and move extra context below the request.",
      ),
    );
  }

  if (body && !hasCallToAction(body)) {
    issues.push(
      makeIssue(
        "missing-action",
        "warning",
        "Draft does not include a clear next action.",
        "Ask for a specific reply, review, approval, or confirmation.",
      ),
    );
  }

  if (containsHarshPhrase(body) || /!!|\?\?/.test(body) || countShoutingWords(body) > 1) {
    issues.push(
      makeIssue(
        "tone-risk",
        "warning",
        "Draft contains wording or punctuation that can read as harsh.",
        "Use calmer phrasing and remove repeated punctuation.",
      ),
    );
  }

  if (body && draft.channel === "email" && !hasGreeting(body)) {
    issues.push(
      makeIssue(
        "missing-greeting",
        "info",
        "Draft does not start with a greeting.",
        "Add a short greeting when the recipient is known.",
      ),
    );
  }

  if (body && !hasSignoff(body)) {
    issues.push(
      makeIssue(
        "missing-signoff",
        "info",
        "Draft does not include a signoff.",
        "Close with a simple signoff so the message feels complete.",
      ),
    );
  }

  const blocking = issues.filter((issue) => issue.severity === "blocking").length;
  const warnings = issues.filter((issue) => issue.severity === "warning").length;
  const info = issues.filter((issue) => issue.severity === "info").length;
  const score = Math.max(0, Math.min(100, 100 - blocking * 40 - warnings * 12 - info * 5));
  const status = blocking > 0 ? "blocked" : warnings > 0 ? "needs-review" : "ready";

  return {
    id: draft.id,
    status,
    reviewRequired: status !== "ready",
    score,
    issues,
    metrics: {
      wordCount,
      sentenceCount,
      hasGreeting: hasGreeting(body),
      hasSignoff: hasSignoff(body),
      hasCallToAction: hasCallToAction(body),
    },
    normalizedDraft: clone(draft),
  };
}

function applyTone(body, tone) {
  if (!body) {
    return body;
  }

  if (tone === "formal") {
    return body.replace(/^Hi\b/i, "Hello").replace(/^Hey\b/i, "Hello");
  }

  if (tone === "warm") {
    return body.replace(/\bThanks,\s*$/i, "Thank you,");
  }

  if (tone === "concise") {
    return body
      .replace(/\bI just wanted to\b/gi, "I want to")
      .replace(/\bI am writing to\b/gi, "I");
  }

  return body;
}

function rewriteBody(draft, analysis) {
  if (!draft.body) {
    return {
      body: "",
      appliedChanges: [],
    };
  }

  let nextBody = draft.body;
  const appliedChanges = [];

  for (const phrase of HARSH_PHRASES) {
    if (phrase.pattern.test(nextBody)) {
      nextBody = nextBody.replace(phrase.pattern, phrase.replacement);
      appliedChanges.push(phrase.label);
    }
    phrase.pattern.lastIndex = 0;
  }

  if (/!!+/.test(nextBody) || /\?\?+/.test(nextBody)) {
    nextBody = nextBody.replace(/!{2,}/g, "!").replace(/\?{2,}/g, "?");
    appliedChanges.push("Collapse repeated punctuation.");
  }

  if (!analysis.metrics.hasGreeting && draft.recipientName) {
    nextBody = `Hi ${draft.recipientName},\n\n${nextBody}`;
    appliedChanges.push("Add recipient greeting.");
  }

  if (!analysis.metrics.hasCallToAction) {
    nextBody = `${nextBody}\n\nPlease let me know what next step you recommend.`;
    appliedChanges.push("Add a clear next-action request.");
  }

  if (!analysis.metrics.hasSignoff) {
    const signoffName = draft.senderName ? `\n${draft.senderName}` : "";
    nextBody = `${nextBody}\n\nThanks,${signoffName}`;
    appliedChanges.push("Add a simple signoff.");
  }

  nextBody = applyTone(normalizeWhitespace(nextBody), draft.tone);

  return {
    body: nextBody,
    appliedChanges,
  };
}

export function improveDraft(input) {
  try {
    const draft = normalizeDraftInput(input);
    const analysis = analyzeDraft(draft);
    const rewrite = rewriteBody(draft, analysis);
    const subject = draft.subject || suggestSubjectLine(rewrite.body || draft.body);

    return {
      id: draft.id,
      status: analysis.status,
      loading: false,
      error: null,
      reviewRequired: analysis.reviewRequired,
      score: analysis.score,
      input: clone(draft),
      output: {
        subject,
        body: rewrite.body,
        tone: draft.tone,
        channel: draft.channel,
        audience: draft.audience,
      },
      issues: analysis.issues,
      suggestions: analysis.issues.map((issue) => ({
        issueId: issue.id,
        severity: issue.severity,
        suggestion: issue.suggestion,
      })),
      appliedChanges: rewrite.appliedChanges,
      metrics: analysis.metrics,
    };
  } catch (error) {
    return {
      id: "draft-error",
      status: "error",
      loading: false,
      error: {
        code: "invalid-input",
        message: error instanceof Error ? error.message : "Unable to review draft.",
      },
      reviewRequired: true,
      score: 0,
      input: null,
      output: null,
      issues: [],
      suggestions: [],
      appliedChanges: [],
      metrics: null,
    };
  }
}

export function summarizeResults(results) {
  const summary = {
    totalDrafts: results.length,
    ready: 0,
    needsReview: 0,
    blocked: 0,
    errors: 0,
  };

  for (const result of results) {
    if (result.status === "ready") {
      summary.ready += 1;
    } else if (result.status === "needs-review") {
      summary.needsReview += 1;
    } else if (result.status === "blocked") {
      summary.blocked += 1;
    } else if (result.status === "error") {
      summary.errors += 1;
    }
  }

  return summary;
}

export function createDraftImproverService(options = {}) {
  const defaults = options.defaults ?? {};
  let state = {
    status: "idle",
    loading: false,
    error: null,
  };

  function setState(nextState) {
    state = { ...state, ...nextState };
  }

  return {
    getState() {
      return clone(state);
    },

    improveDraft(draft) {
      setState({ status: "loading", loading: true, error: null });
      const nextDraft =
        draft && typeof draft === "object" && !Array.isArray(draft)
          ? { ...defaults, ...draft }
          : draft;
      const result = improveDraft(nextDraft);
      setState({
        status: result.status === "error" ? "error" : "ready",
        loading: false,
        error: result.error,
      });
      return result;
    },

    improveMany(drafts) {
      if (!Array.isArray(drafts)) {
        const errorResult = improveDraft(null);
        setState({ status: "error", loading: false, error: errorResult.error });
        return {
          loading: false,
          error: errorResult.error,
          results: [],
          summary: summarizeResults([]),
        };
      }

      setState({ status: "loading", loading: true, error: null });
      const results = drafts.map((draft) => {
        if (!draft || typeof draft !== "object" || Array.isArray(draft)) {
          return improveDraft(draft);
        }
        return improveDraft({ ...defaults, ...draft });
      });
      setState({ status: "ready", loading: false, error: null });

      return {
        loading: false,
        error: null,
        results,
        summary: summarizeResults(results),
      };
    },
  };
}
