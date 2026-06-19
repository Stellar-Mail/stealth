import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const currentDir = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(currentDir, "..", "fixtures", "sample-deadline-messages.json");

const allowedStatuses = new Set(["detected", "needs-review", "missed", "ignored"]);
const allowedUrgencies = new Set(["overdue", "today", "soon", "later", "unknown"]);
const requiredStatuses = ["detected", "needs-review", "missed", "ignored"];

async function loadFixture() {
  const raw = await readFile(fixturePath, "utf8");
  return JSON.parse(raw);
}

test("sample deadline fixture follows the local detection contract", async () => {
  const fixture = await loadFixture();

  assert.equal(fixture.tool, "deadline-detector");
  assert.ok(Array.isArray(fixture.sourceMessages), "sourceMessages must be an array");
  assert.ok(Array.isArray(fixture.expectedDeadlines), "expectedDeadlines must be an array");
  assert.equal(fixture.sourceMessages.length, fixture.expectedDeadlines.length);
  assert.match(fixture.runContext.now, /^\d{4}-\d{2}-\d{2}T/);

  const sourceIds = new Set(fixture.sourceMessages.map((message) => message.id));
  const seenStatuses = new Set();

  for (const source of fixture.sourceMessages) {
    assert.ok(source.id, "source message needs a stable id");
    assert.ok(source.sender.endsWith(".test"), `${source.id} must use synthetic sender data`);
    assert.equal(source.containsPersonalData, false, `${source.id} must not include personal data`);
    assert.match(source.receivedAt, /^\d{4}-\d{2}-\d{2}T/);
  }

  for (const deadline of fixture.expectedDeadlines) {
    assert.ok(deadline.id, "deadline needs a stable id");
    assert.ok(deadline.title, `${deadline.id} needs a title`);
    assert.ok(sourceIds.has(deadline.sourceMessageId), `${deadline.id} source message is missing`);
    assert.ok(allowedStatuses.has(deadline.status), `${deadline.id} has invalid status`);
    assert.ok(allowedUrgencies.has(deadline.urgency), `${deadline.id} has invalid urgency`);
    assert.equal(typeof deadline.confidence, "number", `${deadline.id} confidence is numeric`);
    assert.ok(deadline.confidence >= 0 && deadline.confidence <= 1);

    if (deadline.dueDate !== null) {
      assert.match(deadline.dueDate, /^\d{4}-\d{2}-\d{2}$/);
    }

    if (deadline.dueTime !== null) {
      assert.match(deadline.dueTime, /^\d{2}:\d{2}$/);
    }

    if (deadline.status === "detected") {
      assert.equal(deadline.reviewRequired, false, `${deadline.id} should be ready to offer`);
      assert.ok(deadline.dueDate, `${deadline.id} detected rows need dueDate`);
      assert.ok(deadline.confidence >= 0.9, `${deadline.id} detected rows need high confidence`);
    }

    if (deadline.status !== "detected") {
      assert.equal(
        deadline.reviewRequired,
        true,
        `${deadline.id} non-detected rows must require review`,
      );
    }

    if (deadline.status === "missed") {
      assert.equal(deadline.urgency, "overdue", `${deadline.id} missed rows must be overdue`);
    }

    if (deadline.status === "ignored") {
      assert.equal(deadline.dueDate, null, `${deadline.id} ignored rows must not schedule dates`);
      assert.equal(deadline.urgency, "unknown", `${deadline.id} ignored rows use unknown urgency`);
    }

    seenStatuses.add(deadline.status);
  }

  for (const status of requiredStatuses) {
    assert.ok(seenStatuses.has(status), `fixture must include ${status} status`);
  }
});
