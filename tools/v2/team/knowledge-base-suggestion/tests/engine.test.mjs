import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  DEFAULT_OPTIONS,
  normalizeSuggestionInput,
  scoreArticle,
  suggestKnowledgeBaseArticles,
  tokenize,
  validateArticle,
  validateSuggestionInput,
} from "../engine.mjs";

const currentDir = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(currentDir, "..", "fixtures", "kb-suggestions.json");

async function loadFixtures() {
  const raw = await readFile(fixturePath, "utf8");
  return JSON.parse(raw);
}

test("validateSuggestionInput reports malformed request fields", () => {
  const errors = validateSuggestionInput({
    id: "",
    subject: "",
    body: "",
    teamId: 123,
    labels: "security",
  });

  assert.deepEqual(errors, [
    "id is required",
    "subject is required",
    "body is required",
    "teamId must be a string when provided",
    "labels must be an array when provided",
  ]);
});

test("tokenize normalizes HTML and ignores short/common words", () => {
  assert.deepEqual(tokenize("<b>Please</b> reset the shared mailbox access"), [
    "reset",
    "shared",
    "mailbox",
    "access",
  ]);
});

test("normalizeSuggestionInput documents a large-input warning", () => {
  const result = normalizeSuggestionInput({
    id: "msg-large",
    subject: "Long support request",
    body: "mailbox ".repeat(DEFAULT_OPTIONS.maxInputChars),
    teamId: "support",
    labels: ["Access", "Mailbox"],
  });

  assert.equal(result.ok, true);
  assert.ok(result.warnings.includes("body-truncated"));
  assert.deepEqual(result.value.labels, ["access", "mailbox"]);
  assert.ok(result.value.tokens.includes("mailbox"));
});

test("validateArticle reports invalid local article fixtures", () => {
  assert.deepEqual(validateArticle({ id: "", title: "", keywords: "mail" }), [
    "article id is required",
    "article title is required",
    "article keywords must be an array",
  ]);
});

test("scoreArticle rewards keyword, label, team, and high-priority matches", async () => {
  const { articles, requests } = await loadFixtures();
  const normalized = normalizeSuggestionInput(requests.mailboxAccess).value;
  const score = scoreArticle(articles[0], normalized);

  assert.equal(score.article.id, "kb-001");
  assert.ok(score.score >= 6);
  assert.ok(score.matchedTerms.includes("mailbox"));
  assert.ok(score.reasons.includes("keyword-match"));
  assert.ok(score.reasons.includes("label-match"));
  assert.ok(score.reasons.includes("team-match"));
  assert.ok(score.reasons.includes("high-priority"));
});

test("suggestKnowledgeBaseArticles ranks the most relevant mailbox article first", async () => {
  const { articles, requests } = await loadFixtures();
  const result = suggestKnowledgeBaseArticles(requests.mailboxAccess, articles);

  assert.equal(result.state, "success");
  assert.equal(result.ok, true);
  assert.equal(result.suggestions[0].articleId, "kb-001");
  assert.ok(result.suggestions[0].score >= result.suggestions.at(-1).score);
});

test("suggestKnowledgeBaseArticles supports security report context", async () => {
  const { articles, requests } = await loadFixtures();
  const result = suggestKnowledgeBaseArticles(requests.securityReport, articles);

  assert.equal(result.state, "success");
  assert.equal(result.suggestions[0].articleId, "kb-002");
  assert.ok(result.suggestions[0].matchedTerms.includes("phishing"));
});

test("suggestKnowledgeBaseArticles returns empty state when no article passes the threshold", async () => {
  const { articles, requests } = await loadFixtures();
  const result = suggestKnowledgeBaseArticles(requests.unknown, articles, {
    ...DEFAULT_OPTIONS,
    minScore: 10,
  });

  assert.equal(result.state, "empty");
  assert.deepEqual(result.suggestions, []);
});

test("suggestKnowledgeBaseArticles returns error state for invalid input", async () => {
  const { articles } = await loadFixtures();
  const result = suggestKnowledgeBaseArticles({ id: "", subject: "", body: "" }, articles);

  assert.equal(result.state, "error");
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("id is required"));
});

test("suggestKnowledgeBaseArticles caps suggestion count", async () => {
  const { articles, requests } = await loadFixtures();
  const result = suggestKnowledgeBaseArticles(requests.mailboxAccess, articles, {
    maxSuggestions: 1,
  });

  assert.equal(result.suggestions.length, 1);
  assert.equal(result.suggestions[0].articleId, "kb-001");
});
