/**
 * Knowledge Base Suggestion - Core Service
 *
 * Deterministic folder-local article suggestion logic. No network calls,
 * secrets, production data, or main app integration.
 */

export class KnowledgeBaseSuggestionError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = "KnowledgeBaseSuggestionError";
    this.field = field;
  }
}

export const LIMITS = Object.freeze({
  MAX_QUERY_LENGTH: 500,
  MAX_CONTEXT_LENGTH: 2000,
  MAX_ARTICLES: 200,
  MAX_TAGS: 12,
  MAX_TAG_LENGTH: 64,
  MAX_RESULTS: 10,
  DEFAULT_RESULTS: 5,
  DEFAULT_MIN_SCORE: 4,
  ALLOWED_STATUSES: ["published", "draft", "archived"],
  ALLOWED_CATEGORIES: [
    "account",
    "billing",
    "delivery",
    "policy",
    "product",
    "security",
    "technical",
    "other",
  ],
});

const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "can",
  "do",
  "for",
  "how",
  "i",
  "in",
  "is",
  "it",
  "my",
  "of",
  "on",
  "or",
  "the",
  "to",
  "we",
  "what",
  "with",
]);

export function sanitizeText(value, maxLength = LIMITS.MAX_CONTEXT_LENGTH) {
  if (typeof value !== "string") return "";
  const sanitized = value.replace(/[\x00-\x1F\x7F]/g, " ").replace(/\s+/g, " ").trim();
  return sanitized.length > maxLength ? sanitized.slice(0, maxLength).trim() : sanitized;
}

export function tokenizeText(value) {
  const sanitized = sanitizeText(value).toLowerCase();
  if (!sanitized) return [];
  const tokens = sanitized
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));

  return [...new Set(tokens)];
}

function validateId(value, field) {
  const id = sanitizeText(value, 128);
  if (!id) throw new KnowledgeBaseSuggestionError(`${field} is required`, field);
  if (!ID_PATTERN.test(id)) {
    throw new KnowledgeBaseSuggestionError(`${field} contains invalid characters`, field);
  }
  return id;
}

function validateOptionalId(value, field) {
  if (value === undefined || value === null || value === "") return null;
  return validateId(value, field);
}

function validateEnum(value, allowed, field, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  const sanitized = sanitizeText(value, 64).toLowerCase();
  if (!allowed.includes(sanitized)) {
    throw new KnowledgeBaseSuggestionError(
      `${field} must be one of: ${allowed.join(", ")}`,
      field,
    );
  }
  return sanitized;
}

function validateStringArray(value, field, { required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) throw new KnowledgeBaseSuggestionError(`${field} is required`, field);
    return [];
  }
  if (!Array.isArray(value)) {
    throw new KnowledgeBaseSuggestionError(`${field} must be an array`, field);
  }
  if (value.length > LIMITS.MAX_TAGS) {
    throw new KnowledgeBaseSuggestionError(`${field} exceeds ${LIMITS.MAX_TAGS} items`, field);
  }
  return value.map((entry, index) => {
    const sanitized = sanitizeText(entry, LIMITS.MAX_TAG_LENGTH).toLowerCase();
    if (!sanitized) {
      throw new KnowledgeBaseSuggestionError(`${field}[${index}] must be a string`, field);
    }
    return sanitized;
  });
}

export function validateSuggestionRequest(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new KnowledgeBaseSuggestionError("request must be a plain object", "request");
  }

  const query = sanitizeText(input.query, LIMITS.MAX_QUERY_LENGTH);
  if (!query) throw new KnowledgeBaseSuggestionError("query is required", "query");

  const maxResults =
    input.maxResults === undefined
      ? LIMITS.DEFAULT_RESULTS
      : Number.parseInt(String(input.maxResults), 10);
  if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > LIMITS.MAX_RESULTS) {
    throw new KnowledgeBaseSuggestionError(
      `maxResults must be between 1 and ${LIMITS.MAX_RESULTS}`,
      "maxResults",
    );
  }

  return {
    query,
    threadId: validateOptionalId(input.threadId, "threadId"),
    category: validateEnum(input.category, LIMITS.ALLOWED_CATEGORIES, "category"),
    productArea: sanitizeText(input.productArea, 80).toLowerCase() || null,
    tags: validateStringArray(input.tags, "tags"),
    context: sanitizeText(input.context, LIMITS.MAX_CONTEXT_LENGTH),
    maxResults,
    minScore:
      input.minScore === undefined
        ? LIMITS.DEFAULT_MIN_SCORE
        : Number.parseInt(String(input.minScore), 10),
  };
}

export function validateKnowledgeBaseArticle(article) {
  if (article === null || typeof article !== "object" || Array.isArray(article)) {
    throw new KnowledgeBaseSuggestionError("article must be a plain object", "article");
  }

  const id = validateId(article.id, "id");
  const title = sanitizeText(article.title, 180);
  const summary = sanitizeText(article.summary, 500);
  const body = sanitizeText(article.body, 4000);
  if (!title) throw new KnowledgeBaseSuggestionError("title is required", "title");
  if (!summary) throw new KnowledgeBaseSuggestionError("summary is required", "summary");
  if (!body) throw new KnowledgeBaseSuggestionError("body is required", "body");

  const category = validateEnum(article.category, LIMITS.ALLOWED_CATEGORIES, "category", "other");
  const status = validateEnum(article.status, LIMITS.ALLOWED_STATUSES, "status", "published");

  return {
    id,
    title,
    summary,
    body,
    category,
    status,
    url: sanitizeText(article.url, 300) || `kb://${id}`,
    productAreas: validateStringArray(article.productAreas, "productAreas"),
    tags: validateStringArray(article.tags, "tags"),
    keywords: validateStringArray(article.keywords, "keywords"),
    relatedQuestions: validateStringArray(article.relatedQuestions, "relatedQuestions"),
    updatedAt: sanitizeText(article.updatedAt, 40) || null,
  };
}

function countMatches(needles, haystack) {
  let count = 0;
  for (const needle of needles) {
    if (haystack.has(needle)) count += 1;
  }
  return count;
}

function uniqueMatchedTerms(...groups) {
  return [...new Set(groups.flat().filter(Boolean))].sort();
}

function confidenceForScore(score) {
  if (score >= 22) return "high";
  if (score >= 10) return "medium";
  return "low";
}

export function scoreKnowledgeBaseArticle(articleInput, requestInput) {
  const article = validateKnowledgeBaseArticle(articleInput);
  const request = validateSuggestionRequest(requestInput);

  if (article.status !== "published") {
    return {
      article,
      score: 0,
      confidence: "low",
      matchedTerms: [],
      reasons: ["Article is not published."],
    };
  }

  const queryTokens = tokenizeText(`${request.query} ${request.context}`);
  const titleTokens = new Set(tokenizeText(article.title));
  const summaryTokens = new Set(tokenizeText(article.summary));
  const bodyTokens = new Set(tokenizeText(article.body));
  const keywordTokens = new Set(article.keywords.flatMap(tokenizeText));
  const tagTokens = new Set(article.tags.flatMap(tokenizeText));
  const questionTokens = new Set(article.relatedQuestions.flatMap(tokenizeText));

  const titleMatches = queryTokens.filter((token) => titleTokens.has(token));
  const summaryMatches = queryTokens.filter((token) => summaryTokens.has(token));
  const bodyMatches = queryTokens.filter((token) => bodyTokens.has(token));
  const keywordMatches = queryTokens.filter((token) => keywordTokens.has(token));
  const questionMatches = queryTokens.filter((token) => questionTokens.has(token));

  const requestTags = request.tags.flatMap(tokenizeText);
  const tagMatches = requestTags.filter((token) => tagTokens.has(token));
  const productMatches = request.productArea
    ? article.productAreas.filter((area) => area === request.productArea)
    : [];

  let score = 0;
  const reasons = [];

  if (request.category && request.category === article.category) {
    score += 6;
    reasons.push(`Category match: ${article.category}.`);
  }
  if (productMatches.length > 0) {
    score += 5;
    reasons.push(`Product area match: ${productMatches.join(", ")}.`);
  }
  if (titleMatches.length > 0) {
    score += titleMatches.length * 5;
    reasons.push(`Title matches: ${titleMatches.join(", ")}.`);
  }
  if (keywordMatches.length > 0) {
    score += keywordMatches.length * 4;
    reasons.push(`Keyword matches: ${keywordMatches.join(", ")}.`);
  }
  if (tagMatches.length > 0) {
    score += tagMatches.length * 4;
    reasons.push(`Tag matches: ${tagMatches.join(", ")}.`);
  }
  if (questionMatches.length > 0) {
    score += questionMatches.length * 3;
    reasons.push(`Related question matches: ${questionMatches.join(", ")}.`);
  }
  if (summaryMatches.length > 0) {
    score += summaryMatches.length * 2;
    reasons.push(`Summary matches: ${summaryMatches.join(", ")}.`);
  }
  if (bodyMatches.length > 0) {
    score += bodyMatches.length;
    reasons.push(`Body matches: ${bodyMatches.join(", ")}.`);
  }

  const matchedTerms = uniqueMatchedTerms(
    titleMatches,
    keywordMatches,
    tagMatches,
    questionMatches,
    summaryMatches,
    bodyMatches,
  );

  return {
    article,
    score,
    confidence: confidenceForScore(score),
    matchedTerms,
    reasons: reasons.length > 0 ? reasons : ["No meaningful local match."],
  };
}

export function createLoadingState(query = "") {
  return {
    status: "loading",
    isLoading: true,
    error: null,
    query: sanitizeText(query, LIMITS.MAX_QUERY_LENGTH),
    suggestions: [],
    totalArticlesEvaluated: 0,
  };
}

export function createEmptyState(query = "") {
  return {
    status: "empty",
    isLoading: false,
    error: null,
    query: sanitizeText(query, LIMITS.MAX_QUERY_LENGTH),
    suggestions: [],
    totalArticlesEvaluated: 0,
  };
}

export function createErrorState(error, query = "") {
  return {
    status: "error",
    isLoading: false,
    error: {
      message: error instanceof Error ? error.message : String(error),
      field: error instanceof KnowledgeBaseSuggestionError ? error.field : null,
    },
    query: sanitizeText(query, LIMITS.MAX_QUERY_LENGTH),
    suggestions: [],
    totalArticlesEvaluated: 0,
  };
}

export function suggestKnowledgeBaseArticles(input, options = {}) {
  let request;
  try {
    request = validateSuggestionRequest(input);
  } catch (error) {
    return createErrorState(error, input?.query ?? "");
  }

  const articles = options.articles ?? [];
  if (!Array.isArray(articles)) {
    return createErrorState(
      new KnowledgeBaseSuggestionError("articles must be an array", "articles"),
      request.query,
    );
  }
  if (articles.length > LIMITS.MAX_ARTICLES) {
    return createErrorState(
      new KnowledgeBaseSuggestionError(
        `articles exceeds ${LIMITS.MAX_ARTICLES} items`,
        "articles",
      ),
      request.query,
    );
  }

  const scored = [];
  for (const article of articles) {
    try {
      const result = scoreKnowledgeBaseArticle(article, request);
      if (result.score >= request.minScore) scored.push(result);
    } catch (error) {
      return createErrorState(error, request.query);
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.article.title.localeCompare(b.article.title);
  });

  const suggestions = scored.slice(0, request.maxResults).map((result) => ({
    articleId: result.article.id,
    title: result.article.title,
    summary: result.article.summary,
    category: result.article.category,
    url: result.article.url,
    score: result.score,
    confidence: result.confidence,
    matchedTerms: result.matchedTerms,
    reasons: result.reasons,
  }));

  if (suggestions.length === 0) {
    return {
      ...createEmptyState(request.query),
      totalArticlesEvaluated: articles.length,
    };
  }

  return {
    status: "success",
    isLoading: false,
    error: null,
    query: request.query,
    suggestions,
    totalArticlesEvaluated: articles.length,
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createKnowledgeBaseSuggestionService(options = {}) {
  const articles = options.articles ?? [];
  const latencyMs = Number.isFinite(options.latencyMs) ? options.latencyMs : 0;
  const failure = options.failure ?? null;

  return {
    createLoadingState,
    async suggest(input) {
      if (latencyMs > 0) await delay(latencyMs);
      if (failure) return createErrorState(failure, input?.query ?? "");
      return suggestKnowledgeBaseArticles(input, { articles });
    },
  };
}
