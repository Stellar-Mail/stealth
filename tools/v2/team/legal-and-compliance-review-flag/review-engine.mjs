const HTML_TAG = /<[^>]+>/g;
const NON_WORD = /[^a-z0-9]+/gi;
const WHITESPACE = /\s+/g;

export const DEFAULT_REVIEW_OPTIONS = Object.freeze({
  maxBodyChars: 10000,
  maxRules: 50,
  reviewThreshold: 4,
});

export const DEFAULT_RULES = Object.freeze([
  {
    id: "legal-contract",
    label: "Contract language",
    severity: "high",
    keywords: ["contract", "agreement", "terms", "msa", "dpa", "nda"],
    nextAction: "Route to legal owner before responding.",
    score: 5,
  },
  {
    id: "privacy-data",
    label: "Privacy or personal data",
    severity: "high",
    keywords: ["personal data", "pii", "gdpr", "ccpa", "privacy", "data subject"],
    nextAction: "Request privacy review and avoid sharing raw personal data.",
    score: 5,
  },
  {
    id: "regulatory-request",
    label: "Regulatory request",
    severity: "critical",
    keywords: ["subpoena", "regulator", "law enforcement", "court order", "audit notice"],
    nextAction: "Escalate immediately to legal and compliance leads.",
    score: 8,
  },
  {
    id: "payment-dispute",
    label: "Payment or billing dispute",
    severity: "medium",
    keywords: ["chargeback", "refund dispute", "billing dispute", "invoice dispute"],
    nextAction: "Attach account context and route to finance compliance.",
    score: 3,
  },
  {
    id: "security-disclosure",
    label: "Security disclosure",
    severity: "high",
    keywords: ["vulnerability", "breach", "incident", "security disclosure", "exploit"],
    nextAction: "Open a coordinated security review before external replies.",
    score: 5,
  },
]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value, maxChars = DEFAULT_REVIEW_OPTIONS.maxBodyChars) {
  const raw = typeof value === "string" ? value : "";
  const cleaned = raw.replace(HTML_TAG, " ").replace(WHITESPACE, " ").trim();

  if (cleaned.length <= maxChars) {
    return { text: cleaned, truncated: false };
  }

  return {
    text: cleaned.slice(0, Math.max(0, maxChars - 3)).trimEnd() + "...",
    truncated: true,
  };
}

function normalizePhrase(value) {
  return String(value).toLowerCase().replace(NON_WORD, " ").replace(WHITESPACE, " ").trim();
}

function unique(values) {
  return [...new Set(values)];
}

export function validateReviewContext(input) {
  if (!isPlainObject(input)) {
    return ["input must be an object"];
  }

  const errors = [];
  if (!String(input.id ?? "").trim()) errors.push("id is required");
  if (!String(input.subject ?? "").trim()) errors.push("subject is required");
  if (!String(input.body ?? "").trim()) errors.push("body is required");
  if (input.source !== undefined && typeof input.source !== "string") {
    errors.push("source must be a string when provided");
  }
  if (input.labels !== undefined && !Array.isArray(input.labels)) {
    errors.push("labels must be an array when provided");
  }

  return errors;
}

export function normalizeReviewContext(input, options = DEFAULT_REVIEW_OPTIONS) {
  const config = { ...DEFAULT_REVIEW_OPTIONS, ...options };
  const errors = validateReviewContext(input);
  if (errors.length > 0) {
    return { ok: false, errors, warnings: [], value: null };
  }

  const subject = cleanText(input.subject, 240);
  const body = cleanText(input.body, config.maxBodyChars);
  const labels = Array.isArray(input.labels)
    ? input.labels.map((label) => normalizePhrase(label)).filter(Boolean)
    : [];
  const combinedText = normalizePhrase(`${subject.text} ${body.text} ${labels.join(" ")}`);
  const warnings = [];

  if (subject.truncated) warnings.push("subject-truncated");
  if (body.truncated) warnings.push("body-truncated");

  return {
    ok: true,
    errors: [],
    warnings,
    value: {
      id: cleanText(input.id, 120).text,
      subject: subject.text,
      body: body.text,
      source: typeof input.source === "string" ? input.source : "unknown",
      labels: unique(labels),
      combinedText,
    },
  };
}

export function validateReviewRule(rule) {
  if (!isPlainObject(rule)) return ["rule must be an object"];

  const errors = [];
  if (!String(rule.id ?? "").trim()) errors.push("rule id is required");
  if (!String(rule.label ?? "").trim()) errors.push("rule label is required");
  if (!["low", "medium", "high", "critical"].includes(rule.severity)) {
    errors.push("rule severity is invalid");
  }
  if (!Array.isArray(rule.keywords) || rule.keywords.length === 0) {
    errors.push("rule keywords must be a non-empty array");
  }
  if (!Number.isFinite(Number(rule.score)) || Number(rule.score) <= 0) {
    errors.push("rule score must be positive");
  }

  return errors;
}

export function matchReviewRule(rule, normalizedContext) {
  const errors = validateReviewRule(rule);
  if (errors.length > 0) {
    return { rule, matched: false, matchedTerms: [], score: 0, errors };
  }

  const matchedTerms = rule.keywords
    .map((keyword) => normalizePhrase(keyword))
    .filter((keyword) => keyword && normalizedContext.combinedText.includes(keyword));

  return {
    rule,
    matched: matchedTerms.length > 0,
    matchedTerms,
    score: matchedTerms.length > 0 ? Number(rule.score) + matchedTerms.length - 1 : 0,
    errors: [],
  };
}

function highestSeverity(matches) {
  const rank = { low: 1, medium: 2, high: 3, critical: 4 };
  return matches.reduce((current, match) => {
    return rank[match.severity] > rank[current] ? match.severity : current;
  }, "low");
}

export function classifyReviewContext(input, rules = DEFAULT_RULES, options = DEFAULT_REVIEW_OPTIONS) {
  const config = { ...DEFAULT_REVIEW_OPTIONS, ...options };
  const normalized = normalizeReviewContext(input, config);
  if (!normalized.ok) {
    return {
      state: "error",
      ok: false,
      errors: normalized.errors,
      warnings: [],
      reviewRequired: false,
      severity: "low",
      score: 0,
      matches: [],
      nextActions: [],
    };
  }

  if (!Array.isArray(rules) || rules.length === 0) {
    return {
      state: "empty",
      ok: true,
      errors: [],
      warnings: normalized.warnings,
      reviewRequired: false,
      severity: "low",
      score: 0,
      matches: [],
      nextActions: [],
    };
  }

  const ruleSet = rules.slice(0, config.maxRules);
  const matches = ruleSet
    .map((rule) => matchReviewRule(rule, normalized.value))
    .filter((match) => match.matched)
    .map((match) => ({
      ruleId: match.rule.id,
      label: match.rule.label,
      severity: match.rule.severity,
      score: match.score,
      matchedTerms: match.matchedTerms,
      nextAction: match.rule.nextAction,
    }));
  const score = matches.reduce((sum, match) => sum + match.score, 0);
  const reviewRequired = score >= config.reviewThreshold || matches.some((match) => match.severity === "critical");

  return {
    state: matches.length > 0 ? "success" : "empty",
    ok: true,
    errors: [],
    warnings: [...normalized.warnings, ...(rules.length > config.maxRules ? ["rules-capped"] : [])],
    reviewRequired,
    severity: matches.length > 0 ? highestSeverity(matches) : "low",
    score,
    matches,
    nextActions: unique(matches.map((match) => match.nextAction).filter(Boolean)),
  };
}
