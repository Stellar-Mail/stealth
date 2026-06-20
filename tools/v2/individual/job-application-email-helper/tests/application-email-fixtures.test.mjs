import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const currentDir = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(currentDir, "..", "fixtures", "sample-application-emails.json");

const allowedPurposes = new Set(["referral", "cold-application", "follow-up"]);
const allowedStatuses = new Set(["ready", "needs-review", "blocked", "sent-sample"]);
const allowedTones = new Set(["concise", "warm", "formal"]);
const requiredStatuses = ["ready", "needs-review", "blocked", "sent-sample"];

async function loadFixture() {
  const raw = await readFile(fixturePath, "utf8");
  return JSON.parse(raw);
}

test("sample application email fixture follows the local review contract", async () => {
  const fixture = await loadFixture();

  assert.equal(fixture.tool, "job-application-email-helper");
  assert.ok(Array.isArray(fixture.sourceRequests), "sourceRequests must be an array");
  assert.ok(Array.isArray(fixture.expectedDrafts), "expectedDrafts must be an array");
  assert.equal(fixture.sourceRequests.length, fixture.expectedDrafts.length);

  const sourceIds = new Set(fixture.sourceRequests.map((request) => request.id));
  const sourceById = new Map(fixture.sourceRequests.map((request) => [request.id, request]));
  const seenStatuses = new Set();

  for (const draft of fixture.expectedDrafts) {
    assert.ok(draft.id, "draft needs a stable id");
    assert.ok(draft.role, `${draft.id} needs a target role`);
    assert.ok(draft.company, `${draft.id} needs a target company`);
    assert.ok(allowedPurposes.has(draft.purpose), `${draft.id} has invalid purpose`);
    assert.ok(allowedStatuses.has(draft.status), `${draft.id} has invalid status`);
    assert.ok(allowedTones.has(draft.tone), `${draft.id} has invalid tone`);
    assert.ok(Array.isArray(draft.requiredFields), `${draft.id} requiredFields must be an array`);
    assert.ok(sourceIds.has(draft.sourceRequestId), `${draft.id} source request is missing`);

    if (draft.status === "blocked" || draft.status === "needs-review") {
      assert.equal(draft.reviewRequired, true, `${draft.id} must require review`);
    }

    if (draft.status === "ready" || draft.status === "sent-sample") {
      assert.equal(draft.reviewRequired, false, `${draft.id} should not require review`);
    }

    const source = sourceById.get(draft.sourceRequestId);
    if (source?.hasPortfolio === false) {
      assert.equal(draft.status, "needs-review", `${draft.id} missing portfolio must need review`);
    }

    if (source?.hasContactConsent === false) {
      assert.equal(draft.status, "blocked", `${draft.id} missing consent must be blocked`);
      assert.ok(draft.requiredFields.includes("consent"), `${draft.id} must require consent`);
    }

    if (source?.hasResume === true) {
      assert.ok(draft.requiredFields.includes("resume"), `${draft.id} should track resume context`);
    }

    seenStatuses.add(draft.status);
  }

  for (const status of requiredStatuses) {
    assert.ok(seenStatuses.has(status), `fixture must include ${status} status`);
  }
});
