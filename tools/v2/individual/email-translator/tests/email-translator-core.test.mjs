import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  createEmailTranslatorLoadingState,
  detectLanguage,
  getSupportedLanguagePairs,
  translateEmail,
  translateEmailBatch,
  validateTranslationRequest,
} from "../index.mjs";

const currentDir = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(currentDir, "..", "fixtures", "translation-core-fixtures.json");
const supportedLanguages = new Set(["en", "es", "fr", "de", "pt"]);

async function loadFixture() {
  const raw = await readFile(fixturePath, "utf8");
  return JSON.parse(raw);
}

test("translation fixture follows the folder-local request contract", async () => {
  const fixture = await loadFixture();

  assert.equal(fixture.tool, "email-translator");
  assert.match(fixture.runContext.now, /^\d{4}-\d{2}-\d{2}T/);
  assert.ok(Array.isArray(fixture.sourceRequests), "sourceRequests must be an array");
  assert.ok(Array.isArray(fixture.expectedOutcomes), "expectedOutcomes must be an array");
  assert.equal(fixture.sourceRequests.length, fixture.expectedOutcomes.length);

  for (const request of fixture.sourceRequests) {
    assert.ok(request.id, "request needs a stable id");
    assert.ok(request.sourceText.length > 0, `${request.id} sourceText is required`);
    assert.ok(supportedLanguages.has(request.targetLanguage), `${request.id} target is supported`);
    assert.equal(request.sourceText.includes("@"), false, `${request.id} must avoid real emails`);
  }
});

test("translateEmail produces deterministic local translations", async () => {
  const fixture = await loadFixture();

  for (const expected of fixture.expectedOutcomes) {
    const request = fixture.sourceRequests.find((item) => item.id === expected.id);
    const response = translateEmail(request, { now: fixture.runContext.now });

    assert.equal(response.status, "ready");
    assert.equal(response.isLoading, false);
    assert.equal(response.error, null);
    assert.equal(response.result.id, expected.id);
    assert.equal(response.result.generatedAt, fixture.runContext.now);
    assert.equal(response.result.sourceLanguage, expected.sourceLanguage);
    assert.equal(response.result.targetLanguage, expected.targetLanguage);
    assert.ok(response.result.translatedText.length > 0);
    assert.ok(response.result.segments.length >= 1);
    assert.ok(response.result.metrics.replacements >= expected.requiredText.length);
    assert.ok(response.result.metrics.confidence > 0.35);

    for (const requiredText of expected.requiredText) {
      assert.ok(
        response.result.translatedText.includes(requiredText),
        `${expected.id} should include ${requiredText}`,
      );
    }
  }
});

test("language detection and supported pair helpers are stable", () => {
  assert.equal(detectLanguage("Hola, por favor revise la factura.").language, "es");
  assert.equal(detectLanguage("Bonjour, merci pour la facture.").language, "fr");
  assert.equal(detectLanguage("Hallo, bitte prufen Sie die Rechnung.").language, "de");

  const pairs = getSupportedLanguagePairs();
  assert.ok(pairs.includes("en:es"));
  assert.ok(pairs.includes("es:en"));
  assert.ok(pairs.includes("pt:en"));
});

test("validation and UI state helpers expose loading and error contracts", () => {
  const loading = createEmailTranslatorLoadingState();
  assert.equal(loading.status, "loading");
  assert.equal(loading.isLoading, true);
  assert.equal(loading.result, null);

  const validation = validateTranslationRequest({
    id: "unsafe-translation",
    sourceLanguage: "en",
    targetLanguage: "es",
    sourceText: "<script>alert('x')</script>",
  });
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((error) => error.code === "active-content"));

  const response = translateEmail({
    id: "empty-source",
    sourceLanguage: "en",
    targetLanguage: "es",
    sourceText: "",
  });
  assert.equal(response.status, "error");
  assert.equal(response.isLoading, false);
  assert.equal(response.result, null);
  assert.ok(response.error.messages.some((message) => message.includes("sourceText")));
});

test("translateEmailBatch summarizes translated and errored requests", async () => {
  const fixture = await loadFixture();
  const batch = translateEmailBatch(
    [
      ...fixture.sourceRequests,
      {
        id: "missing-target",
        sourceLanguage: "en",
        sourceText: "Hello team",
      },
    ],
    { now: fixture.runContext.now },
  );

  assert.equal(batch.status, "needs-review");
  assert.equal(batch.totalRequests, fixture.sourceRequests.length + 1);
  assert.equal(batch.translated, fixture.sourceRequests.length);
  assert.equal(batch.errors, 1);
  assert.equal(batch.responses.length, fixture.sourceRequests.length + 1);
});
