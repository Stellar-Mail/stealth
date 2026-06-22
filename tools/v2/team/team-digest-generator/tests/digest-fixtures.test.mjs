import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const currentDir = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(currentDir, "..", "fixtures", "sample-team-activity.json");
const servicePath = join(currentDir, "..", "services", "digest-generator.service.mjs");

const allowedTypes = new Set(["new_message", "pending_item", "completed_item", "team_summary"]);
const allowedPriorities = new Set(["low", "medium", "high"]);
const requiredTypes = ["new_message", "pending_item", "completed_item", "team_summary"];

async function loadFixture() {
  const raw = await readFile(fixturePath, "utf8");
  return JSON.parse(raw);
}

test("sample team activity fixture follows the local digest contract", async () => {
  const fixture = await loadFixture();

  assert.equal(fixture.tool, "team-digest-generator");
  assert.ok(Array.isArray(fixture.activity), "activity must be an array");
  assert.ok(fixture.expectedDigest, "expectedDigest must exist");
  assert.ok(Array.isArray(fixture.expectedDigest.items), "expectedDigest.items must be an array");
  assert.equal(fixture.activity.length, fixture.expectedDigest.items.length);

  const activityIds = new Set(fixture.activity.map((a) => a.id));
  const seenTypes = new Set();

  for (const item of fixture.expectedDigest.items) {
    assert.ok(item.id, "item needs a stable id");
    assert.ok(item.title, `${item.id} needs a title`);
    assert.ok(allowedTypes.has(item.type), `${item.id} has invalid type: ${item.type}`);
    assert.ok(allowedPriorities.has(item.priority), `${item.id} has invalid priority`);

    if (item.sourceEmailId !== null) {
      assert.ok(
        activityIds.has(item.sourceEmailId),
        `${item.id} source email ${item.sourceEmailId} is missing`,
      );
    }

    if (item.timestamp !== null) {
      assert.match(
        item.timestamp,
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/,
        `${item.id} timestamp must be ISO 8601`,
      );
    }

    if (item.requiresAttention === true && item.priority !== "high") {
      const activity = fixture.activity.find((a) => a.id === item.sourceEmailId);
      if (activity) {
        const hasActionSignals = activity.signals?.some(
          (s) => s.includes("needs") || s.includes("action required"),
        );
        assert.ok(
          hasActionSignals,
          `${item.id} requires attention but is not high priority and has no action signals`,
        );
      }
    }

    seenTypes.add(item.type);
  }

  for (const type of requiredTypes) {
    assert.ok(seenTypes.has(type), `fixture must include ${type} digest item type`);
  }

  // Validate summary
  const summary = fixture.expectedDigest.summary;
  assert.ok(summary, "expectedDigest must have a summary");
  assert.equal(typeof summary.totalItems, "number", "summary.totalItems must be a number");
  assert.equal(
    typeof summary.requiresAttention,
    "number",
    "summary.requiresAttention must be a number",
  );
  assert.ok(Array.isArray(summary.teamMembers), "summary.teamMembers must be an array");
  assert.equal(summary.totalItems, fixture.expectedDigest.items.length);
});

test("digest generator service produces matching output from fixture input", async () => {
  const fixture = await loadFixture();
  const { generateDigest } = await import(pathToFileURL(servicePath).href);

  const result = generateDigest(fixture.activity, fixture.date, fixture.generatedAt);

  assert.equal(result.date, fixture.expectedDigest.date);
  assert.equal(result.team, fixture.expectedDigest.team);
  assert.equal(result.items.length, fixture.expectedDigest.items.length);
  assert.equal(result.summary.totalItems, fixture.expectedDigest.summary.totalItems);
  assert.equal(result.summary.requiresAttention, fixture.expectedDigest.summary.requiresAttention);

  // Verify items match expected structure
  for (let i = 0; i < result.items.length; i++) {
    const actual = result.items[i];
    const expected = fixture.expectedDigest.items[i];

    assert.equal(actual.id, expected.id, `item ${i} id mismatch`);
    assert.equal(actual.type, expected.type, `item ${i} type mismatch`);
    assert.equal(actual.sourceEmailId, expected.sourceEmailId, `item ${i} sourceEmailId mismatch`);
    assert.equal(actual.priority, expected.priority, `item ${i} priority mismatch`);
    assert.equal(
      actual.requiresAttention,
      expected.requiresAttention,
      `item ${i} requiresAttention mismatch`,
    );
  }
});
