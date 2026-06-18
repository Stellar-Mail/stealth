import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const currentDir = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(currentDir, "..", "fixtures", "sample-team-analytics.json");

const allowedStatuses = new Set(["healthy", "watch", "needs-attention", "blocked"]);
const requiredStatuses = ["healthy", "watch", "needs-attention", "blocked"];

async function loadFixture() {
  const raw = await readFile(fixturePath, "utf8");
  return JSON.parse(raw);
}

test("sample team analytics fixture follows the local review contract", async () => {
  const fixture = await loadFixture();

  assert.equal(fixture.tool, "team-analytics-dashboard");
  assert.ok(Array.isArray(fixture.sourceReports), "sourceReports must be an array");
  assert.ok(Array.isArray(fixture.expectedSnapshots), "expectedSnapshots must be an array");
  assert.equal(fixture.sourceReports.length, fixture.expectedSnapshots.length);

  const sourceIds = new Set(fixture.sourceReports.map((report) => report.id));
  const sourceById = new Map(fixture.sourceReports.map((report) => [report.id, report]));
  const seenStatuses = new Set();

  for (const snapshot of fixture.expectedSnapshots) {
    assert.ok(snapshot.id, "snapshot needs a stable id");
    assert.ok(snapshot.team, `${snapshot.id} needs a team`);
    assert.ok(snapshot.period, `${snapshot.id} needs a period`);
    assert.ok(allowedStatuses.has(snapshot.status), `${snapshot.id} has invalid status`);
    assert.equal(
      typeof snapshot.totalThreads,
      "number",
      `${snapshot.id} totalThreads must be numeric`,
    );
    assert.ok(snapshot.totalThreads >= 0, `${snapshot.id} totalThreads must be non-negative`);
    assert.equal(
      typeof snapshot.openBacklog,
      "number",
      `${snapshot.id} openBacklog must be numeric`,
    );
    assert.ok(snapshot.openBacklog >= 0, `${snapshot.id} openBacklog must be non-negative`);
    assert.ok(sourceIds.has(snapshot.sourceReportId), `${snapshot.id} source report is missing`);

    if (snapshot.averageFirstResponseHours !== null) {
      assert.equal(
        typeof snapshot.averageFirstResponseHours,
        "number",
        `${snapshot.id} response time must be numeric or null`,
      );
      assert.ok(
        snapshot.averageFirstResponseHours >= 0,
        `${snapshot.id} response time must be non-negative`,
      );
    }

    if (snapshot.status === "blocked" || snapshot.status === "needs-attention") {
      assert.equal(snapshot.reviewRequired, true, `${snapshot.id} must require review`);
    }

    if (snapshot.status === "healthy") {
      assert.equal(
        snapshot.reviewRequired,
        false,
        `${snapshot.id} healthy snapshots should not require review`,
      );
      assert.ok(snapshot.totalThreads > 0, `${snapshot.id} healthy snapshots need source volume`);
      assert.ok(
        snapshot.openBacklog < 20,
        `${snapshot.id} healthy snapshots should have low backlog`,
      );
    }

    const source = sourceById.get(snapshot.sourceReportId);
    if (source?.hasCompleteSourceData === false) {
      assert.equal(
        snapshot.status,
        "blocked",
        `${snapshot.id} incomplete source data must be blocked`,
      );
      assert.equal(
        snapshot.averageFirstResponseHours,
        null,
        `${snapshot.id} blocked data should not invent metrics`,
      );
    }

    if (snapshot.openBacklog >= 30) {
      assert.notEqual(
        snapshot.status,
        "healthy",
        `${snapshot.id} high backlog should not be healthy`,
      );
    }

    seenStatuses.add(snapshot.status);
  }

  for (const status of requiredStatuses) {
    assert.ok(seenStatuses.has(status), `fixture must include ${status} status`);
  }
});
