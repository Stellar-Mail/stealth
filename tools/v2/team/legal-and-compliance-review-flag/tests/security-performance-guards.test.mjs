import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  REVIEW_SAFETY_LIMITS,
  evaluateLegalReviewInput,
  sanitizeReviewText,
} from "../services/review-safety-guards.mjs";

const currentDir = dirname(fileURLToPath(import.meta.url));
const toolDir = join(currentDir, "..");
const fixturePath = join(toolDir, "fixtures", "hostile-review-inputs.json");
const securityDocPath = join(toolDir, "docs", "security-and-performance.md");
const performanceDocPath = join(toolDir, "docs", "performance-notes.md");

async function readJson(path) {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw);
}

function expandFixtureInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return input;
  }

  const expanded = { ...input };

  if (expanded.bodyRepeat) {
    expanded.body = expanded.bodyRepeat.value.repeat(expanded.bodyRepeat.count);
    delete expanded.bodyRepeat;
  }

  if (expanded.attachmentsRepeat) {
    expanded.attachments = Array.from({ length: expanded.attachmentsRepeat }, (_, index) => ({
      id: `attachment-${index + 1}`,
      name: `contract-evidence-${index + 1}.pdf`,
      sizeBytes: 1024 + index,
      mimeType: "application/pdf",
    }));
    delete expanded.attachmentsRepeat;
  }

  if (expanded.historyRepeat) {
    expanded.history = Array.from({ length: expanded.historyRepeat }, (_, index) => ({
      id: `history-${index + 1}`,
      action: "review-note",
      actor: "synthetic-reviewer",
      occurredAt: `2026-07-${String((index % 28) + 1).padStart(2, "0")}T00:00:00.000Z`,
    }));
    delete expanded.historyRepeat;
  }

  return expanded;
}

test("review safety guard handles malformed and hostile inputs", async () => {
  const fixture = await readJson(fixturePath);

  assert.equal(fixture.tool, "legal-and-compliance-review-flag");
  assert.ok(Array.isArray(fixture.cases));

  for (const reviewCase of fixture.cases) {
    const result = evaluateLegalReviewInput(expandFixtureInput(reviewCase.input));

    for (const expectedError of reviewCase.expectedErrors || []) {
      assert.ok(result.errors.includes(expectedError), `${reviewCase.id} missing ${expectedError}`);
    }

    for (const expectedWarning of reviewCase.expectedWarnings || []) {
      assert.ok(
        result.warnings.includes(expectedWarning),
        `${reviewCase.id} missing ${expectedWarning}`,
      );
    }
  }
});

test("sanitization removes control characters and redacts secret-like assignments", () => {
  const result = sanitizeReviewText("Line\u0000 one token=abc123\nprivate_key=super-secret");

  assert.equal(result.redactions, 2);
  assert.equal(result.text.includes("\u0000"), false);
  assert.equal(result.text.includes("abc123"), false);
  assert.equal(result.text.includes("super-secret"), false);
  assert.ok(result.text.includes("token=[redacted]"));
  assert.ok(result.text.includes("private_key=[redacted]"));
});

test("large review payloads are bounded before future UI rendering", () => {
  const input = {
    subject: "Large compliance review",
    body: "x".repeat(REVIEW_SAFETY_LIMITS.maxTextChars + 500),
    attachments: Array.from({ length: REVIEW_SAFETY_LIMITS.maxAttachments + 5 }, (_, index) => ({
      name: `evidence-${index}.pdf`,
    })),
    history: Array.from({ length: REVIEW_SAFETY_LIMITS.maxHistoryItems + 5 }, (_, index) => ({
      action: `review-${index}`,
    })),
  };

  const result = evaluateLegalReviewInput(input);

  assert.equal(result.ok, true);
  assert.ok(result.warnings.includes("body-truncated"));
  assert.ok(result.warnings.includes("attachments-truncated"));
  assert.ok(result.warnings.includes("history-truncated"));
  assert.equal(result.sanitized.body.length, REVIEW_SAFETY_LIMITS.maxTextChars);
  assert.equal(result.sanitized.attachments.length, REVIEW_SAFETY_LIMITS.maxAttachments);
  assert.equal(result.sanitized.history.length, REVIEW_SAFETY_LIMITS.maxHistoryItems);
});

test("security and performance documentation names the isolated constraints", async () => {
  const [securityDoc, performanceDoc] = await Promise.all([
    readFile(securityDocPath, "utf8"),
    readFile(performanceDocPath, "utf8"),
  ]);

  assert.ok(securityDoc.includes("malformed payloads"));
  assert.ok(securityDoc.includes("Secret-like assignments") || securityDoc.includes("Secret"));
  assert.ok(securityDoc.includes("Out of Scope"));
  assert.ok(performanceDoc.includes("12,000 characters"));
  assert.ok(performanceDoc.includes("pagination or virtualization"));
});
