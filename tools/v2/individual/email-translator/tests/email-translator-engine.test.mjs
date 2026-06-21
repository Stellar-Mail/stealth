import assert from "node:assert/strict";
import test from "node:test";

import {
  EMAIL_TRANSLATOR_MAX_CHARS,
  buildTranslationDraft,
  createTranslationJob,
  detectTranslationWarnings,
  normalizeTranslatorInput,
} from "../services/email-translator-engine.mjs";

test("normalizes valid translation input", () => {
  const result = normalizeTranslatorInput({
    sourceLanguage: "Auto",
    targetLanguage: "Spanish",
    sourceText: " Hello team,\n\nPlease review the contract. ",
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.sourceLanguage, "auto");
  assert.equal(result.value.targetLanguage, "spanish");
  assert.equal(result.value.preserveTone, true);
  assert.equal(result.value.sourceText, "Hello team,\n\nPlease review the contract.");
});

test("rejects empty, oversized, and same-language requests", () => {
  assert.equal(normalizeTranslatorInput({ sourceText: " " }).error, "empty_source");
  assert.equal(
    normalizeTranslatorInput({
      sourceText: "x".repeat(EMAIL_TRANSLATOR_MAX_CHARS + 1),
      targetLanguage: "French",
    }).error,
    "source_too_large"
  );
  assert.equal(
    normalizeTranslatorInput({
      sourceText: "Bonjour",
      sourceLanguage: "French",
      targetLanguage: "French",
    }).error,
    "same_language"
  );
});

test("creates a deterministic translation job with review warnings", () => {
  const input = {
    sourceText: "Invoice total is $150 due on 2026-07-01. Details: https://example.com",
    targetLanguage: "German",
    preserveTone: false,
  };

  const first = createTranslationJob(input);
  const second = createTranslationJob(input);

  assert.equal(first.status, "ready");
  assert.equal(first.job.id, second.job.id);
  assert.deepEqual(first.job.warnings, ["links", "dates", "currency", "numbers"]);
  assert.equal(first.job.targetLanguage, "german");
  assert.equal(first.job.preserveTone, false);
});

test("detects translation review warning categories", () => {
  assert.deepEqual(detectTranslationWarnings("Meet on 2026-08-12 with 3 links"), [
    "dates",
    "numbers",
  ]);
});

test("builds a draft result with a review checklist", () => {
  const job = createTranslationJob({
    sourceText: "Hello, please confirm delivery.",
    targetLanguage: "Spanish",
  }).job;

  const draft = buildTranslationDraft(job, " Hola, confirme la entrega. ");

  assert.equal(draft.status, "success");
  assert.equal(draft.jobId, job.id);
  assert.equal(draft.targetLanguage, "spanish");
  assert.equal(draft.translatedText, "Hola, confirme la entrega.");
  assert.ok(draft.reviewChecklist.some((item) => item.includes("dates")));
});

test("marks an empty translated draft as incomplete", () => {
  const job = createTranslationJob({
    sourceText: "Hello",
    targetLanguage: "Spanish",
  }).job;

  const draft = buildTranslationDraft(job, "");

  assert.equal(draft.status, "empty");
  assert.equal(draft.translatedText, "");
});
