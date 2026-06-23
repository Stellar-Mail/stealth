const HTML_TAG = /<[^>]+>/g;
const NON_WORD = /[^a-z0-9]+/gi;
const WHITESPACE = /\s+/g;
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "has",
  "have",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "our",
  "please",
  "the",
  "this",
  "to",
  "with",
]);

export const DEFAULT_OPTIONS = Object.freeze({
  maxInputChars: 8000,
  maxSuggestions: 3,
  minScore: 2,
});

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value, maxChars = DEFAULT_OPTIONS.maxInputChars) {
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

export function tokenize(value) {
  return cleanText(value, Number.MAX_SAFE_INTEGER)
    .text.toLowerCase()
    .replace(NON_WORD, " ")
    .split(WHITESPACE)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function unique(values) {
  return [...new Set(values)];
}

export function validateSuggestionInput(input) {
  if (!isPlainObject(input)) {
    return ["input must be an object"];
  }

  const errors = [];
  if (!String(input.id ?? "").trim()) errors.push("id is required");
  if (!String(input.subject ?? "").trim()) errors.push("subject is required");
  if (!String(input.body ?? "").trim()) errors.push("body is required");
  if (input.teamId !== undefined && typeof input.teamId !== "string") {
    errors.push("teamId must be a string when provided");
  }
  if (input.labels !== undefined && !Array.isArray(input.labels)) {
    errors.push("labels must be an array when provided");
  }

  return errors;
}

export function normalizeSuggestionInput(input, options = DEFAULT_OPTIONS) {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const errors = validateSuggestionInput(input);
  if (errors.length > 0) {
    return { ok: false, errors, value: null, warnings: [] };
  }

  const subject = cleanText(input.subject, 240);
  const body = cleanText(input.body, config.maxInputChars);
  const labels = Array.isArray(input.labels)
    ? input.labels.map((label) => cleanText(label, 60).text.toLowerCase()).filter(Boolean)
    : [];
  const warnings = [];

  if (body.truncated) warnings.push("body-truncated");
  if (subject.truncated) warnings.push("subject-truncated");

  return {
    ok: true,
    errors: [],
    warnings,
    value: {
      id: cleanText(input.id, 120).text,
      subject: subject.text,
      body: body.text,
      teamId: typeof input.teamId === "string" ? input.teamId : null,
      labels: unique(labels),
      tokens: unique([...tokenize(subject.text), ...tokenize(body.text), ...labels]),
    },
  };
}

export function validateArticle(article) {
  const errors = [];
  if (!isPlainObject(article)) return ["article must be an object"];
  if (!String(article.id ?? "").trim()) errors.push("article id is required");
  if (!String(article.title ?? "").trim()) errors.push("article title is required");
  if (!Array.isArray(article.keywords)) errors.push("article keywords must be an array");
  if (article.teamIds !== undefined && !Array.isArray(article.teamIds)) {
    errors.push("article teamIds must be an array when provided");
  }
  return errors;
}

export function scoreArticle(article, normalizedInput) {
  const articleErrors = validateArticle(article);
  if (articleErrors.length > 0) {
    return { article, score: 0, matchedTerms: [], reasons: ["invalid-article"] };
  }

  const inputTokens = new Set(normalizedInput.tokens);
  const articleTerms = unique([
    ...tokenize(article.title),
    ...tokenize(article.summary ?? ""),
    ...article.keywords.map((keyword) => String(keyword).toLowerCase()),
  ]);
  const matchedTerms = articleTerms.filter((term) => inputTokens.has(term));
  const reasons = [];
  let score = matchedTerms.length;

  if (normalizedInput.teamId && Array.isArray(article.teamIds) && article.teamIds.includes(normalizedInput.teamId)) {
    score += 2;
    reasons.push("team-match");
  }

  const inputLabels = new Set(normalizedInput.labels);
  const articleTags = Array.isArray(article.tags) ? article.tags.map((tag) => String(tag).toLowerCase()) : [];
  const tagMatches = articleTags.filter((tag) => inputLabels.has(tag));
  if (tagMatches.length > 0) {
    score += tagMatches.length;
    reasons.push("label-match");
  }

  if (article.priority === "high") {
    score += 1;
    reasons.push("high-priority");
  }

  if (matchedTerms.length > 0) reasons.push("keyword-match");

  return {
    article,
    score,
    matchedTerms,
    reasons: unique(reasons),
  };
}

export function suggestKnowledgeBaseArticles(input, articles, options = DEFAULT_OPTIONS) {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const normalized = normalizeSuggestionInput(input, config);
  if (!normalized.ok) {
    return {
      state: "error",
      ok: false,
      errors: normalized.errors,
      warnings: [],
      suggestions: [],
    };
  }

  if (!Array.isArray(articles) || articles.length === 0) {
    return {
      state: "empty",
      ok: true,
      errors: [],
      warnings: normalized.warnings,
      suggestions: [],
    };
  }

  const suggestions = articles
    .map((article) => scoreArticle(article, normalized.value))
    .filter((result) => result.score >= config.minScore)
    .sort((a, b) => b.score - a.score || a.article.title.localeCompare(b.article.title))
    .slice(0, config.maxSuggestions)
    .map((result) => ({
      articleId: result.article.id,
      title: result.article.title,
      summary: result.article.summary ?? "",
      href: result.article.href ?? null,
      score: result.score,
      matchedTerms: result.matchedTerms,
      reasons: result.reasons,
    }));

  return {
    state: suggestions.length > 0 ? "success" : "empty",
    ok: true,
    errors: [],
    warnings: normalized.warnings,
    suggestions,
  };
}
