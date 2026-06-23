import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  DEFAULT_REVIEW_OPTIONS,
  DEFAULT_RULES,
  classifyReviewContext,
  matchReviewRule,
  normalizeReviewContext,
  validateReviewContext,
  validateReviewRule,
} from "../review-engine.mjs";

const currentDir = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(currentDir, "..", "fixtures", "review-cases.json");

async function loadFixtures() {
  const raw = await readFile(fixturePath, "utf8");
  return JSON.parse(raw);
}

test("validateReviewContext reports malformed inputs", () => {
  const errors = validateReviewContext({
    id: "",
    subject: "",
    body: "",
    source: 123,
    labels: "legal",
  });

  assert.deepEqual(errors, [
    "id is required",
    "subject is required",
    "body is required",
    "source must be a string when provided",
    "labels must be an array when provided",
  ]);
});

test("normalizeReviewContext strips HTML and reports body truncation", () => {
  const result = normalizeReviewContext({
    id: "review-html",
    subject: "<b>Contract</b> review",
    body: "<script>bad()</script>" + "privacy ".repeat(DEFAULT_REVIEW_OPTIONS.maxBodyChars),
    labels: ["Legal"],
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.subject, "Contract review");
  assert.ok(result.warnings.includes("body-truncated"));
  assert.ok(result.value.combinedText.includes("privacy"));
  assert.ok(result.value.labels.includes("legal"));
});

test("validateReviewRule reports invalid rules", () => {
  assert.deepEqual(validateReviewRule({ id: "", label: "", severity: "urgent", keywords: [], score: 0 }), [
    "rule id is required",
    "rule label is required",
    "rule severity is invalid",
    "rule keywords must be a non-empty array",
    "rule score must be positive",
  ]);
});

test("matchReviewRule identifies matched terms and score", async () => {
  const { cases } = await loadFixtures();
  const normalized = normalizeReviewContext(cases.contractReview).value;
  const match = matchReviewRule(DEFAULT_RULES[0], normalized);

  assert.equal(match.matched, true);
  assert.ok(match.matchedTerms.includes("msa"));
  assert.ok(match.matchedTerms.includes("dpa"));
  assert.ok(match.score >= DEFAULT_RULES[0].score);
});

test("classifyReviewContext flags contract review as high severity", async () => {
  const { cases } = await loadFixtures();
  const result = classifyReviewContext(cases.contractReview);

  assert.equal(result.state, "success");
  assert.equal(result.ok, true);
  assert.equal(result.reviewRequired, true);
  assert.equal(result.severity, "high");
  assert.ok(result.matches.some((match) => match.ruleId === "legal-contract"));
  assert.ok(result.nextActions.includes("Route to legal owner before responding."));
});

test("classifyReviewContext treats regulatory requests as critical", async () => {
  const { cases } = await loadFixtures();
  const result = classifyReviewContext(cases.regulatoryRequest);

  assert.equal(result.reviewRequired, true);
  assert.equal(result.severity, "critical");
  assert.ok(result.matches.some((match) => match.ruleId === "regulatory-request"));
});

test("classifyReviewContext returns empty state for routine support", async () => {
  const { cases } = await loadFixtures();
  const result = classifyReviewContext(cases.routineSupport);

  assert.equal(result.state, "empty");
  assert.equal(result.reviewRequired, false);
  assert.equal(result.score, 0);
  assert.deepEqual(result.matches, []);
});

test("classifyReviewContext returns error state for invalid context", () => {
  const result = classifyReviewContext({ id: "", subject: "", body: "" });

  assert.equal(result.state, "error");
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("id is required"));
});

test("classifyReviewContext handles no local rules as an empty state", async () => {
  const { cases } = await loadFixtures();
  const result = classifyReviewContext(cases.contractReview, []);

  assert.equal(result.state, "empty");
  assert.equal(result.reviewRequired, false);
  assert.deepEqual(result.nextActions, []);
});

test("classifyReviewContext caps rules and reports a warning", async () => {
  const { cases } = await loadFixtures();
  const manyRules = Array.from({ length: DEFAULT_REVIEW_OPTIONS.maxRules + 2 }, (_, index) => ({
    ...DEFAULT_RULES[0],
    id: `contract-${index}`,
  }));
  const result = classifyReviewContext(cases.contractReview, manyRules);

  assert.ok(result.warnings.includes("rules-capped"));
  assert.equal(result.matches.length, DEFAULT_REVIEW_OPTIONS.maxRules);
});
