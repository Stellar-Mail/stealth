import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  KnowledgeBaseSuggestionError,
  createEmptyState,
  createErrorState,
  createKnowledgeBaseSuggestionService,
  createLoadingState,
  scoreKnowledgeBaseArticle,
  suggestKnowledgeBaseArticles,
  tokenizeText,
  validateKnowledgeBaseArticle,
  validateSuggestionRequest,
} from "../index.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(__dir, "..", "fixtures", "knowledge-base-fixtures.json");

async function loadFixtures() {
  return JSON.parse(await readFile(fixturePath, "utf8"));
}

test("fixture metadata describes folder-local synthetic data", async () => {
  const data = await loadFixtures();

  assert.equal(data.metadata.tool, "knowledge-base-suggestion");
  assert.equal(data.metadata.scope, "folder-local");
  assert.ok(data.metadata.dataPolicy.some((entry) => entry.includes("Synthetic")));
});

test("tokenizeText removes stop words and deduplicates terms", () => {
  assert.deepEqual(tokenizeText("How do I reset reset my password?"), ["reset", "password"]);
});

test("validateSuggestionRequest sanitizes and normalizes optional fields", () => {
  const request = validateSuggestionRequest({
    query: "  Reset password\r\nplease  ",
    threadId: "thread-001",
    category: "ACCOUNT",
    productArea: " Login ",
    tags: [" Password ", "Login"],
    maxResults: "3",
  });

  assert.equal(request.query, "Reset password please");
  assert.equal(request.category, "account");
  assert.equal(request.productArea, "login");
  assert.deepEqual(request.tags, ["password", "login"]);
  assert.equal(request.maxResults, 3);
});

test("validateSuggestionRequest returns useful error state for invalid input", () => {
  assert.throws(() => validateSuggestionRequest({ query: "" }), KnowledgeBaseSuggestionError);

  const state = suggestKnowledgeBaseArticles({ query: "" }, { articles: [] });
  assert.equal(state.status, "error");
  assert.equal(state.error.field, "query");
});

test("validateKnowledgeBaseArticle rejects unsafe article ids", async () => {
  const { articles } = await loadFixtures();
  assert.throws(
    () => validateKnowledgeBaseArticle({ ...articles[0], id: "../bad" }),
    KnowledgeBaseSuggestionError,
  );
});

test("scoreKnowledgeBaseArticle gives strong matches high confidence", async () => {
  const { articles, requests } = await loadFixtures();
  const request = requests.find((entry) => entry.id === "request-password").input;
  const article = articles.find((entry) => entry.id === "kb-password-reset");

  const score = scoreKnowledgeBaseArticle(article, request);

  assert.ok(score.score >= 20);
  assert.equal(score.confidence, "high");
  assert.ok(score.matchedTerms.includes("password"));
  assert.ok(score.reasons.some((reason) => reason.includes("Category match")));
});

test("archived articles are never suggested", async () => {
  const { articles } = await loadFixtures();
  const state = suggestKnowledgeBaseArticles(
    {
      query: "legacy sign in old login",
      category: "account",
      productArea: "login",
      tags: ["legacy"],
      maxResults: 5,
    },
    { articles },
  );

  assert.equal(
    state.suggestions.some((suggestion) => suggestion.articleId === "kb-legacy-signin"),
    false,
  );
});

test("fixture requests return their expected top article", async () => {
  const { articles, requests } = await loadFixtures();

  for (const request of requests.filter((entry) => entry.expectedTopArticleId)) {
    const state = suggestKnowledgeBaseArticles(request.input, { articles });

    assert.equal(state.status, "success", `${request.id} should return suggestions`);
    assert.equal(
      state.suggestions[0].articleId,
      request.expectedTopArticleId,
      `${request.id} should rank expected article first`,
    );
  }
});

test("unmatched fixture request returns empty state", async () => {
  const { articles, requests } = await loadFixtures();
  const request = requests.find((entry) => entry.id === "request-empty");
  const state = suggestKnowledgeBaseArticles(request.input, { articles });

  assert.equal(state.status, "empty");
  assert.deepEqual(state.suggestions, []);
  assert.equal(state.totalArticlesEvaluated, articles.length);
});

test("maxResults caps the number of returned suggestions", async () => {
  const { articles } = await loadFixtures();
  const state = suggestKnowledgeBaseArticles(
    {
      query: "account login password security",
      category: "account",
      productArea: "login",
      tags: ["login"],
      maxResults: 1,
      minScore: 1,
    },
    { articles },
  );

  assert.equal(state.status, "success");
  assert.equal(state.suggestions.length, 1);
});

test("state builders expose loading, empty, and error states", () => {
  assert.equal(createLoadingState("invoice").status, "loading");
  assert.equal(createLoadingState("invoice").isLoading, true);
  assert.equal(createEmptyState("invoice").status, "empty");

  const errorState = createErrorState(new KnowledgeBaseSuggestionError("bad", "query"), "invoice");
  assert.equal(errorState.status, "error");
  assert.equal(errorState.error.field, "query");
});

test("mock async service returns suggestions without network calls", async () => {
  const { articles } = await loadFixtures();
  const service = createKnowledgeBaseSuggestionService({ articles, latencyMs: 1 });

  const state = await service.suggest({
    query: "Need invoice receipt",
    category: "billing",
    tags: ["invoice"],
  });

  assert.equal(state.status, "success");
  assert.equal(state.suggestions[0].articleId, "kb-download-invoices");
});

test("mock async service can simulate failure as an error state", async () => {
  const service = createKnowledgeBaseSuggestionService({
    failure: new KnowledgeBaseSuggestionError("fixture failure", "service"),
  });
  const state = await service.suggest({ query: "invoice" });

  assert.equal(state.status, "error");
  assert.equal(state.error.field, "service");
});
