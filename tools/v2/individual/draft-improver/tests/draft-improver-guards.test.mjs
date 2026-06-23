import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  DRAFT_IMPROVER_LIMITS,
  normalizeDraftImprovementRequest,
  sanitizeDraftText,
} from "../services/draft-improver-guards.mjs";

const currentDir = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(currentDir, "..", "fixtures", "sample-draft-improvement-requests.json");

async function loadFixture() {
  const raw = await readFile(fixturePath, "utf8");
  return JSON.parse(raw);
}

function issueCodes(issues) {
  return new Set(issues.map((issue) => issue.code));
}

test("sample draft improvement requests follow the local guard contract", async () => {
  const fixture = await loadFixture();

  assert.equal(fixture.tool, "draft-improver");
  assert.ok(Array.isArray(fixture.sourceRequests), "sourceRequests must be an array");

  for (const source of fixture.sourceRequests) {
    const result = normalizeDraftImprovementRequest(source);

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
      assert.ok(result.request.goals.length > 0, `${source.id} must retain goals`);
      assert.equal(result.request.performance.recommendedMode, source.expectedMode ?? "inline");
      assert.doesNotMatch(result.request.draft, /<[^>]*>/, `${source.id} draft must be plain text`);
    }
  }
});

test("large drafts are clipped and routed to async review", () => {
  const draft = "Please make this clearer without changing facts. ".repeat(600);
  const contextMessages = Array.from({ length: 30 }, (_, index) => ({
    id: `ctx-${index}`,
    sender: `sender-${index}@example.test`,
    excerpt: "Prior context line. ".repeat(40),
  }));

  const result = normalizeDraftImprovementRequest({
    id: "large-draft",
    draft,
    goals: ["clarity", "brevity"],
    contextMessages,
    attachments: Array.from({ length: 12 }, (_, index) => ({
      name: `attachment-${index}.txt`,
      bytes: index * 100,
    })),
  });

  assert.equal(result.ok, true);
  assert.equal(result.request.draftTruncated, true);
  assert.ok(result.request.draft.length <= DRAFT_IMPROVER_LIMITS.maxDraftChars);
  assert.equal(result.request.contextMessages.length, DRAFT_IMPROVER_LIMITS.maxContextMessages);
  assert.equal(result.request.attachments.retainedMetadata.length, DRAFT_IMPROVER_LIMITS.maxAttachmentMetadata);
  assert.equal(result.request.performance.recommendedMode, "async-review");
  assert.ok(issueCodes(result.warnings).has("draft:truncated"));
  assert.ok(issueCodes(result.warnings).has("contextMessages:clipped"));
  assert.ok(issueCodes(result.warnings).has("attachments:metadata-clipped"));
});

test("sanitizer strips controls and markup from draft display text", () => {
  const sanitized = sanitizeDraftText("Hi\u0000 <b>team</b> <script>x()</script>");

  assert.equal(sanitized, "Hi team");
  assert.doesNotMatch(sanitized, /script|<|>/i);
});

test("malformed requests fail before draft improvement work", () => {
  const result = normalizeDraftImprovementRequest({
    id: "bad-request",
    draft: "",
    goals: "clarity",
    contextMessages: "not-an-array",
    attachments: "not-an-array",
  });

  const codes = issueCodes(result.errors);

  assert.equal(result.ok, false);
  assert.ok(codes.has("draft:empty"));
  assert.ok(codes.has("goals:invalid-type"));
  assert.ok(codes.has("contextMessages:invalid-type"));
  assert.ok(codes.has("attachments:invalid-type"));
  assert.equal(result.request, null);
});
