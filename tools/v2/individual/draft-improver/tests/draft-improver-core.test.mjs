import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  createDraftImproverLoadingState,
  improveDraft,
  improveDraftBatch,
  validateDraftImproverRequest,
} from "../index.mjs";

const currentDir = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(currentDir, "..", "fixtures", "sample-core-draft-improvements.json");
const validGoals = new Set(["clarity", "concise", "friendly", "professional", "call-to-action"]);

async function loadFixture() {
  const raw = await readFile(fixturePath, "utf8");
  return JSON.parse(raw);
}

test("sample core draft fixture follows the isolated request contract", async () => {
  const fixture = await loadFixture();

  assert.equal(fixture.tool, "draft-improver");
  assert.match(fixture.runContext.now, /^\d{4}-\d{2}-\d{2}T/);
  assert.ok(Array.isArray(fixture.sourceRequests), "sourceRequests must be an array");
  assert.ok(Array.isArray(fixture.expectedOutcomes), "expectedOutcomes must be an array");
  assert.equal(fixture.sourceRequests.length, fixture.expectedOutcomes.length);

  for (const request of fixture.sourceRequests) {
    assert.ok(request.id, "request needs a stable id");
    assert.ok(validGoals.has(request.goal), `${request.id} uses a supported goal`);
    assert.equal(typeof request.body, "string", `${request.id} body must be a string`);
    assert.ok(request.body.length > 0, `${request.id} body must not be empty`);
    assert.equal(request.context.includes("@"), false, `${request.id} must not include real email`);
  }
});

test("improveDraft returns deterministic output with reviewable changes", async () => {
  const fixture = await loadFixture();

  for (const expected of fixture.expectedOutcomes) {
    const request = fixture.sourceRequests.find((item) => item.id === expected.id);
    const response = improveDraft(request, { now: fixture.runContext.now });

    assert.equal(response.status, "ready");
    assert.equal(response.isLoading, false);
    assert.equal(response.error, null);
    assert.equal(response.result.id, expected.id);
    assert.equal(response.result.status, expected.status);
    assert.equal(response.result.generatedAt, fixture.runContext.now);
    assert.ok(response.result.output.subject.startsWith(expected.expectedSubjectPrefix));
    assert.ok(response.result.output.body.length > 0);
    assert.notEqual(response.result.output.body, request.body);
    assert.ok(response.result.output.preview.length <= 180);
    assert.ok(response.result.metrics.originalWordCount > 0);
    assert.ok(response.result.metrics.improvedWordCount > 0);

    const changeTypes = new Set(response.result.changes.map((change) => change.type));
    for (const requiredType of expected.requiredChangeTypes) {
      assert.ok(changeTypes.has(requiredType), `${expected.id} should include ${requiredType}`);
    }
  }
});

test("validation and state helpers expose loading and error contracts", () => {
  const loading = createDraftImproverLoadingState();
  assert.equal(loading.status, "loading");
  assert.equal(loading.isLoading, true);
  assert.equal(loading.result, null);

  const validation = validateDraftImproverRequest({
    id: "unsafe-draft",
    body: "<script>alert('x')</script>",
  });

  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((error) => error.code === "active-content"));

  const response = improveDraft({
    id: "empty-draft",
    body: "",
  });

  assert.equal(response.status, "error");
  assert.equal(response.isLoading, false);
  assert.equal(response.result, null);
  assert.ok(response.error.messages.some((message) => message.includes("required")));
});

test("improveDraftBatch summarizes ready and errored requests", async () => {
  const fixture = await loadFixture();
  const batch = improveDraftBatch(
    [
      ...fixture.sourceRequests,
      {
        id: "empty-draft",
        body: "",
      },
    ],
    { now: fixture.runContext.now },
  );

  assert.equal(batch.totalRequests, fixture.sourceRequests.length + 1);
  assert.equal(batch.status, "needs-review");
  assert.equal(batch.improved, fixture.sourceRequests.length);
  assert.equal(batch.needsReview, 0);
  assert.equal(batch.errors, 1);
  assert.equal(batch.responses.length, fixture.sourceRequests.length + 1);
});
