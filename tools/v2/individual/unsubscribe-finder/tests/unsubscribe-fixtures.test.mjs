import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const currentDir = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(currentDir, "..", "fixtures", "sample-unsubscribe-candidates.json");

const allowedMethods = new Set(["header", "body-link", "none"]);
const allowedStatuses = new Set(["detected", "needs-review", "unsafe", "ignored"]);
const requiredStatuses = ["detected", "needs-review", "unsafe", "ignored"];

async function loadFixture() {
  const raw = await readFile(fixturePath, "utf8");
  return JSON.parse(raw);
}

test("sample unsubscribe fixture follows the local review contract", async () => {
  const fixture = await loadFixture();

  assert.equal(fixture.tool, "unsubscribe-finder");
  assert.ok(Array.isArray(fixture.sourceMessages), "sourceMessages must be an array");
  assert.ok(Array.isArray(fixture.expectedCandidates), "expectedCandidates must be an array");
  assert.equal(fixture.sourceMessages.length, fixture.expectedCandidates.length);

  const sourceIds = new Set(fixture.sourceMessages.map((message) => message.id));
  const sourceById = new Map(fixture.sourceMessages.map((message) => [message.id, message]));
  const seenStatuses = new Set();

  for (const candidate of fixture.expectedCandidates) {
    assert.ok(candidate.id, "candidate needs a stable id");
    assert.ok(candidate.sender, `${candidate.id} needs a sender`);
    assert.ok(allowedMethods.has(candidate.method), `${candidate.id} has invalid method`);
    assert.ok(allowedStatuses.has(candidate.status), `${candidate.id} has invalid status`);
    assert.equal(
      typeof candidate.confidence,
      "number",
      `${candidate.id} confidence must be numeric`,
    );
    assert.ok(
      candidate.confidence >= 0 && candidate.confidence <= 1,
      `${candidate.id} confidence is out of range`,
    );
    assert.equal(
      typeof candidate.safeToOffer,
      "boolean",
      `${candidate.id} safeToOffer must be boolean`,
    );
    assert.ok(
      sourceIds.has(candidate.sourceMessageId),
      `${candidate.id} source message is missing`,
    );
    assert.ok(candidate.reason, `${candidate.id} needs a review reason`);

    if (candidate.status === "detected") {
      assert.equal(
        candidate.safeToOffer,
        true,
        `${candidate.id} detected candidates should be offerable`,
      );
      assert.ok(
        candidate.confidence >= 0.9,
        `${candidate.id} detected candidates need high confidence`,
      );
    }

    if (
      candidate.status === "needs-review" ||
      candidate.status === "unsafe" ||
      candidate.status === "ignored"
    ) {
      assert.equal(
        candidate.safeToOffer,
        false,
        `${candidate.id} must not be offered automatically`,
      );
    }

    const source = sourceById.get(candidate.sourceMessageId);
    if (source?.hasListUnsubscribeHeader) {
      assert.equal(candidate.method, "header", `${candidate.id} should use header method`);
    }

    if (source?.bodyContainsUnsubscribeLink && !source.hasListUnsubscribeHeader) {
      assert.notEqual(
        candidate.status,
        "detected",
        `${candidate.id} body-only links should not auto-detect`,
      );
    }

    if (source?.isTransactional) {
      assert.equal(
        candidate.status,
        "ignored",
        `${candidate.id} transactional messages should be ignored`,
      );
      assert.equal(
        candidate.method,
        "none",
        `${candidate.id} ignored transactional messages should not have a method`,
      );
    }

    seenStatuses.add(candidate.status);
  }

  for (const status of requiredStatuses) {
    assert.ok(seenStatuses.has(status), `fixture must include ${status} status`);
  }
});
