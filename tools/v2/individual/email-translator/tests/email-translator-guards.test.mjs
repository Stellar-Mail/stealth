import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  TRANSLATION_LIMITS,
  normalizeEmailTranslationRequest,
  sanitizeTextForTranslation,
} from "../services/email-translator-guards.mjs";

const currentDir = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(currentDir, "..", "fixtures", "sample-translation-requests.json");

async function loadFixture() {
  const raw = await readFile(fixturePath, "utf8");
  return JSON.parse(raw);
}

function issueCodes(issues) {
  return new Set(issues.map((issue) => issue.code));
}

test("sample translation requests follow the local security contract", async () => {
  const fixture = await loadFixture();

  assert.equal(fixture.tool, "email-translator");
  assert.ok(Array.isArray(fixture.sourceRequests), "sourceRequests must be an array");

  for (const source of fixture.sourceRequests) {
    const result = normalizeEmailTranslationRequest(source);

    assert.equal(result.ok, source.expectedOk, `${source.id} ok status mismatch`);

    if (source.expectedError) {
      assert.ok(issueCodes(result.errors).has(source.expectedError), `${source.id} missing error`);
      assert.equal(result.request, null, `${source.id} must not return a normalized request`);
    }

    if (source.expectedWarning) {
      assert.ok(
        issueCodes(result.warnings).has(source.expectedWarning),
        `${source.id} missing warning`,
      );
    }

    if (result.ok) {
      assert.equal(result.request.id, source.id);
      assert.equal(result.request.performance.recommendedMode, source.expectedMode ?? "inline");
      assert.ok(
        result.request.recipients.every((recipient) => recipient.endsWith(".test")),
        `${source.id} must retain only synthetic recipient data`,
      );
      assert.doesNotMatch(result.request.body, /<[^>]*>/, `${source.id} body must be plain text`);
    }
  }
});

test("large bodies are clipped and assigned chunked processing", () => {
  const body = "Please translate this sentence. ".repeat(900);
  const result = normalizeEmailTranslationRequest({
    id: "large-body",
    sourceLanguage: "en",
    targetLanguage: "fr",
    subject: "Large body",
    body,
    recipients: ["reviewer@example.test"],
  });

  assert.equal(result.ok, true);
  assert.equal(result.request.bodyTruncated, true);
  assert.ok(result.request.body.length <= TRANSLATION_LIMITS.maxBodyChars);
  assert.equal(result.request.performance.recommendedMode, "chunked");
  assert.ok(issueCodes(result.warnings).has("body:truncated"));
});

test("sanitizer strips controls and active markup from safe display text", () => {
  const sanitized = sanitizeTextForTranslation("Hello\u0000 <b>team</b> <script>x()</script>");

  assert.equal(sanitized, "Hello team");
  assert.doesNotMatch(sanitized, /script|<|>/i);
});

test("malformed requests fail before doing translation work", () => {
  const result = normalizeEmailTranslationRequest({
    id: "bad-request",
    sourceLanguage: "en",
    targetLanguage: "en",
    subject: "",
    body: "",
    recipients: "not-an-array",
    attachments: "not-an-array",
  });

  const codes = issueCodes(result.errors);

  assert.equal(result.ok, false);
  assert.ok(codes.has("languages:same"));
  assert.ok(codes.has("content:empty"));
  assert.ok(codes.has("recipients:invalid-type"));
  assert.ok(codes.has("attachments:invalid-type"));
  assert.equal(result.request, null);
});
