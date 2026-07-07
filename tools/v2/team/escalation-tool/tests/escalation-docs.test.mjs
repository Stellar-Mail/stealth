import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const currentDir = dirname(fileURLToPath(import.meta.url));
const toolDir = join(currentDir, "..");
const fixturePath = join(toolDir, "fixtures", "sample-escalation-cases.json");
const readmePath = join(toolDir, "README.md");
const specsPath = join(toolDir, "specs.md");
const testPlanPath = join(toolDir, "docs", "test-plan.md");
const reviewNotesPath = join(toolDir, "docs", "review-notes.md");

const allowedStatuses = new Set(["monitor", "needs-owner", "manager-review", "urgent-escalation"]);
const allowedRiskLevels = new Set(["low", "medium", "high", "critical"]);
const requiredStatuses = ["monitor", "needs-owner", "manager-review", "urgent-escalation"];

async function readJson(path) {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw);
}

test("sample escalation fixture follows the documented contract", async () => {
  const fixture = await readJson(fixturePath);

  assert.equal(fixture.tool, "escalation-tool");
  assert.match(fixture.runContext.now, /^\d{4}-\d{2}-\d{2}T/);
  assert.ok(Array.isArray(fixture.cases), "fixture cases must be an array");
  assert.ok(fixture.cases.length >= requiredStatuses.length);

  const seenStatuses = new Set();
  const seenIds = new Set();

  for (const escalationCase of fixture.cases) {
    assert.ok(escalationCase.id, "case needs a stable id");
    assert.equal(seenIds.has(escalationCase.id), false, `${escalationCase.id} is duplicated`);
    assert.ok(escalationCase.threadId, `${escalationCase.id} needs a thread id`);
    assert.ok(escalationCase.subject, `${escalationCase.id} needs a subject`);
    assert.ok(escalationCase.department, `${escalationCase.id} needs a department`);
    assert.equal(
      escalationCase.containsProductionData,
      false,
      `${escalationCase.id} must stay synthetic`,
    );
    assert.equal(typeof escalationCase.ageHours, "number", `${escalationCase.id} age is numeric`);
    assert.ok(escalationCase.ageHours >= 0, `${escalationCase.id} age must be non-negative`);
    assert.ok(
      allowedRiskLevels.has(escalationCase.riskLevel),
      `${escalationCase.id} risk is invalid`,
    );
    assert.ok(
      allowedStatuses.has(escalationCase.recommendedStatus),
      `${escalationCase.id} status is invalid`,
    );
    assert.ok(Array.isArray(escalationCase.signals), `${escalationCase.id} signals are listed`);
    assert.ok(escalationCase.signals.length > 0, `${escalationCase.id} needs signals`);
    assert.ok(escalationCase.nextAction, `${escalationCase.id} needs a next action`);

    if (escalationCase.riskLevel === "critical") {
      assert.equal(
        escalationCase.recommendedStatus,
        "urgent-escalation",
        `${escalationCase.id} critical risk must escalate urgently`,
      );
    }

    if (!escalationCase.owner) {
      assert.equal(
        escalationCase.recommendedStatus,
        "needs-owner",
        `${escalationCase.id} missing owner must be classified as needs-owner`,
      );
    }

    if (escalationCase.signals.includes("approval-needed")) {
      assert.equal(
        escalationCase.recommendedStatus,
        "manager-review",
        `${escalationCase.id} approval-needed cases require manager review`,
      );
    }

    seenStatuses.add(escalationCase.recommendedStatus);
    seenIds.add(escalationCase.id);
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
    readme.includes("node --test tools/v2/team/escalation-tool/tests/escalation-docs.test.mjs"),
  );
  assert.ok(readme.includes("tools/v2/team/escalation-tool/"));
  assert.ok(specs.includes("urgent-escalation"));
  assert.ok(specs.includes("Do not add inbox ingestion"));
  assert.ok(testPlan.includes("Manual Review Checklist"));
  assert.ok(testPlan.includes("no production data"));
  assert.ok(reviewNotes.includes("Out Of Scope"));
  assert.ok(reviewNotes.toLowerCase().includes("future"));
  assert.ok(reviewNotes.toLowerCase().includes("integration"));
});
