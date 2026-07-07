import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const currentDir = dirname(fileURLToPath(import.meta.url));
const toolDir = join(currentDir, "..");
const fixturePath = join(toolDir, "fixtures", "ownership-review-cases.json");
const readmePath = join(toolDir, "README.md");
const specsPath = join(toolDir, "specs.md");
const testPlanPath = join(toolDir, "docs", "test-plan.md");
const reviewNotesPath = join(toolDir, "docs", "review-notes.md");

const allowedStatuses = new Set(["owned", "needs-owner", "transfer-pending", "stale"]);
const requiredStatuses = ["owned", "needs-owner", "transfer-pending", "stale"];

async function readJson(path) {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw);
}

test("sample ownership fixture follows the documented contract", async () => {
  const fixture = await readJson(fixturePath);

  assert.equal(fixture.tool, "email-ownership-tracker");
  assert.match(fixture.runContext.now, /^\d{4}-\d{2}-\d{2}T/);
  assert.ok(Array.isArray(fixture.cases), "fixture cases must be an array");
  assert.ok(fixture.cases.length >= requiredStatuses.length);

  const seenStatuses = new Set();
  const seenIds = new Set();

  for (const ownershipCase of fixture.cases) {
    assert.ok(ownershipCase.id, "case needs a stable id");
    assert.equal(seenIds.has(ownershipCase.id), false, `${ownershipCase.id} is duplicated`);
    assert.ok(ownershipCase.threadId, `${ownershipCase.id} needs a thread id`);
    assert.ok(ownershipCase.subject, `${ownershipCase.id} needs a subject`);
    assert.ok(ownershipCase.department, `${ownershipCase.id} needs a department`);
    assert.match(ownershipCase.lastChangedAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(typeof ownershipCase.ageHours, "number", `${ownershipCase.id} age is numeric`);
    assert.ok(ownershipCase.ageHours >= 0, `${ownershipCase.id} age must be non-negative`);
    assert.equal(
      ownershipCase.containsProductionData,
      false,
      `${ownershipCase.id} must stay synthetic`,
    );
    assert.ok(
      allowedStatuses.has(ownershipCase.ownershipStatus),
      `${ownershipCase.id} status is invalid`,
    );
    assert.equal(typeof ownershipCase.reviewRequired, "boolean");
    assert.ok(Array.isArray(ownershipCase.signals), `${ownershipCase.id} signals are listed`);
    assert.ok(ownershipCase.signals.length > 0, `${ownershipCase.id} needs signals`);
    assert.ok(ownershipCase.nextAction, `${ownershipCase.id} needs a next action`);

    if (ownershipCase.ownershipStatus === "owned") {
      assert.ok(ownershipCase.currentOwner, `${ownershipCase.id} owned cases need an owner`);
      assert.equal(ownershipCase.reviewRequired, false);
    }

    if (ownershipCase.ownershipStatus === "needs-owner") {
      assert.equal(ownershipCase.currentOwner, "", `${ownershipCase.id} should be unowned`);
      assert.equal(ownershipCase.reviewRequired, true);
      assert.ok(ownershipCase.signals.includes("missing-owner"));
    }

    if (ownershipCase.ownershipStatus === "transfer-pending") {
      assert.ok(ownershipCase.currentOwner, `${ownershipCase.id} needs current owner`);
      assert.ok(ownershipCase.previousOwner, `${ownershipCase.id} needs previous owner`);
      assert.equal(ownershipCase.reviewRequired, true);
    }

    if (ownershipCase.ownershipStatus === "stale") {
      assert.ok(ownershipCase.currentOwner, `${ownershipCase.id} stale cases still have an owner`);
      assert.ok(ownershipCase.signals.includes("stale-owner"));
      assert.equal(ownershipCase.reviewRequired, true);
    }

    seenStatuses.add(ownershipCase.ownershipStatus);
    seenIds.add(ownershipCase.id);
  }

  for (const status of requiredStatuses) {
    assert.ok(seenStatuses.has(status), `fixture must include ${status}`);
  }
});

test("documentation exposes setup, limitations, and review boundaries", async () => {
  const [readme, specs, testPlan, reviewNotes] = await Promise.all([
    readFile(readmePath, "utf8"),
    readFile(specsPath, "utf8"),
    readFile(testPlanPath, "utf8"),
    readFile(reviewNotesPath, "utf8"),
  ]);

  assert.ok(
    readme.includes(
      "node --test tools/v1/team/email-ownership-tracker/tests/email-ownership-docs.test.mjs",
    ),
  );
  assert.ok(readme.includes("tools/v1/team/email-ownership-tracker/"));
  assert.ok(specs.includes("transfer-pending"));
  assert.ok(specs.includes("Do not add inbox writes"));
  assert.ok(testPlan.includes("Manual Review Checklist"));
  assert.ok(testPlan.includes("no live network calls"));
  assert.ok(reviewNotes.includes("Out Of Scope"));
  assert.ok(reviewNotes.toLowerCase().includes("integration"));
});
