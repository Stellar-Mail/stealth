import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const currentDir = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(currentDir, "..", "fixtures", "sample-ownership-events.json");

const allowedActions = new Set(["assigned", "reassigned", "released", "claimed"]);
const allowedStates = new Set(["owned", "unassigned"]);
const allowedAnomalyCodes = new Set([
  "release-without-owner",
  "duplicate-owner-assignment",
  "reassign-without-existing-owner",
  "owner-mismatch",
  "out-of-order-timestamp",
]);

async function loadFixture() {
  const raw = await readFile(fixturePath, "utf8");
  return JSON.parse(raw);
}

test("sample ownership fixture follows the local ownership contract", async () => {
  const fixture = await loadFixture();

  assert.equal(fixture.tool, "email-ownership-tracker");
  assert.ok(Array.isArray(fixture.sourceEvents), "sourceEvents must be an array");
  assert.match(fixture.runContext.now, /^\d{4}-\d{2}-\d{2}T/);

  const report = fixture.expectedReport;
  assert.ok(Array.isArray(report.records), "expectedReport.records must be an array");
  assert.ok(Array.isArray(report.anomalies), "expectedReport.anomalies must be an array");

  const eventIds = new Set();
  for (const event of fixture.sourceEvents) {
    assert.ok(event.id, "source event needs a stable id");
    assert.ok(!eventIds.has(event.id), event.id + " must be unique");
    eventIds.add(event.id);
    assert.ok(event.actor.endsWith(".test"), event.id + " must use synthetic actor data");
    assert.ok(allowedActions.has(event.action), event.id + " has invalid action");
    assert.match(event.timestamp, /^\d{4}-\d{2}-\d{2}T/);
    assert.ok(
      event.owner === null || event.owner.endsWith(".test"),
      event.id + " owner must be synthetic or null",
    );
  }

  const threadIds = new Set();
  let ownedThreads = 0;
  let totalHandoffs = 0;
  for (const record of report.records) {
    assert.ok(record.threadId, "record needs a threadId");
    assert.ok(!threadIds.has(record.threadId), record.threadId + " must be unique");
    threadIds.add(record.threadId);
    assert.ok(allowedStates.has(record.state), record.threadId + " has invalid state");
    assert.equal(typeof record.handoffCount, "number");
    assert.ok(record.handoffCount >= 0, record.threadId + " handoffCount must be >= 0");
    assert.ok(Array.isArray(record.historyEventIds), record.threadId + " needs historyEventIds");
    assert.ok(record.historyEventIds.length > 0, record.threadId + " history must not be empty");

    for (const id of record.historyEventIds) {
      assert.ok(eventIds.has(id), record.threadId + " references unknown event " + id);
    }

    if (record.state === "owned") {
      ownedThreads += 1;
      assert.ok(record.currentOwner, "owned threads need a currentOwner");
    } else {
      assert.equal(record.currentOwner, null, "unassigned threads must have a null owner");
    }

    totalHandoffs += record.handoffCount;
  }

  const seenCodes = new Set();
  for (const anomaly of report.anomalies) {
    assert.ok(allowedAnomalyCodes.has(anomaly.code), "invalid anomaly code " + anomaly.code);
    assert.ok(eventIds.has(anomaly.eventId), "anomaly references unknown event " + anomaly.eventId);
    assert.ok(
      threadIds.has(anomaly.threadId),
      "anomaly references unknown thread " + anomaly.threadId,
    );
    seenCodes.add(anomaly.code);
  }

  assert.ok(ownedThreads >= 1, "fixture must include at least one owned thread");
  assert.ok(threadIds.size - ownedThreads >= 1, "fixture must include an unassigned thread");
  assert.ok(seenCodes.size >= 2, "fixture must exercise at least two anomaly codes");

  assert.equal(report.summary.totalEvents, fixture.sourceEvents.length);
  assert.equal(report.summary.totalThreads, report.records.length);
  assert.equal(report.summary.ownedThreads, ownedThreads);
  assert.equal(report.summary.unassignedThreads, threadIds.size - ownedThreads);
  assert.equal(report.summary.totalHandoffs, totalHandoffs);
  assert.equal(report.summary.anomalies, report.anomalies.length);
});
