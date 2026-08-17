import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const currentDir = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(currentDir, "..", "fixtures", "sample-vendor-mails.json");

const allowedPriorities = new Set(["low", "medium", "high"]);
const allowedStatuses = new Set(["open", "waiting-on-vendor", "blocked", "resolved"]);
const requiredStatuses = ["open", "waiting-on-vendor", "blocked", "resolved"];

async function loadFixture() {
  const raw = await readFile(fixturePath, "utf8");
  return JSON.parse(raw);
}

test("sample vendor mail fixture follows the local review contract", async () => {
  const fixture = await loadFixture();

  assert.equal(fixture.tool, "vendor-mail-tracker");
  assert.ok(Array.isArray(fixture.sourceMessages), "sourceMessages must be an array");
  assert.ok(Array.isArray(fixture.expectedThreads), "expectedThreads must be an array");
  assert.equal(fixture.sourceMessages.length, fixture.expectedThreads.length);

  const sourceIds = new Set(fixture.sourceMessages.map((message) => message.id));
  const sourceById = new Map(fixture.sourceMessages.map((message) => [message.id, message]));
  const seenStatuses = new Set();

  for (const thread of fixture.expectedThreads) {
    assert.ok(thread.id, "thread needs a stable id");
    assert.ok(thread.vendor, `${thread.id} needs a vendor`);
    assert.ok(thread.owner, `${thread.id} needs an owner`);
    assert.ok(allowedPriorities.has(thread.priority), `${thread.id} has invalid priority`);
    assert.ok(allowedStatuses.has(thread.status), `${thread.id} has invalid status`);
    assert.ok(sourceIds.has(thread.sourceMessageId), `${thread.id} source message is missing`);
    assert.match(
      thread.lastContactAt,
      /^\d{4}-\d{2}-\d{2}T/,
      `${thread.id} needs an ISO last contact`,
    );

    if (thread.status === "resolved") {
      assert.equal(
        thread.nextActionDueAt,
        null,
        `${thread.id} resolved threads should not have due dates`,
      );
      assert.equal(
        thread.reviewRequired,
        false,
        `${thread.id} resolved threads should not require review`,
      );
    } else {
      assert.match(
        thread.nextActionDueAt,
        /^\d{4}-\d{2}-\d{2}T/,
        `${thread.id} needs an ISO due date`,
      );
    }

    if (thread.priority === "high" && thread.status !== "resolved") {
      assert.equal(
        thread.reviewRequired,
        true,
        `${thread.id} high-priority open threads require review`,
      );
    }

    if (thread.status === "blocked") {
      assert.equal(thread.reviewRequired, true, `${thread.id} blocked threads must require review`);
    }

    const source = sourceById.get(thread.sourceMessageId);
    if (source && source.hasRequiredDocument === false) {
      assert.equal(thread.status, "blocked", `${thread.id} missing documents must be blocked`);
    }

    if (source && source.vendorResponded === false) {
      assert.equal(
        thread.status,
        "waiting-on-vendor",
        `${thread.id} unanswered vendor threads should wait on vendor`,
      );
    }

    seenStatuses.add(thread.status);
  }

  for (const status of requiredStatuses) {
    assert.ok(seenStatuses.has(status), `fixture must include ${status} status`);
  }
});
