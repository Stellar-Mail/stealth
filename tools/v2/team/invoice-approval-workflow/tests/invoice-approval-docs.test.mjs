import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const currentDir = dirname(fileURLToPath(import.meta.url));
const toolDir = join(currentDir, "..");
const fixturePath = join(toolDir, "fixtures", "sample-approval-cases.json");
const readmePath = join(toolDir, "README.md");
const specsPath = join(toolDir, "specs.md");
const testPlanPath = join(toolDir, "docs", "test-plan.md");
const reviewNotesPath = join(toolDir, "docs", "review-notes.md");

const allowedStatuses = new Set(["ready-for-approval", "needs-review", "blocked", "rejected"]);
const requiredStatuses = ["ready-for-approval", "needs-review", "blocked", "rejected"];

async function readJson(path) {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw);
}

test("sample invoice approval fixture follows the documented contract", async () => {
  const fixture = await readJson(fixturePath);

  assert.equal(fixture.tool, "invoice-approval-workflow");
  assert.match(fixture.runContext.now, /^\d{4}-\d{2}-\d{2}T/);
  assert.ok(Array.isArray(fixture.cases), "fixture cases must be an array");
  assert.ok(fixture.cases.length >= requiredStatuses.length);

  const seenStatuses = new Set();
  const seenIds = new Set();

  for (const approvalCase of fixture.cases) {
    assert.ok(approvalCase.id, "case needs a stable id");
    assert.equal(seenIds.has(approvalCase.id), false, `${approvalCase.id} is duplicated`);
    assert.ok(approvalCase.invoiceId, `${approvalCase.id} needs an invoice id`);
    assert.ok(approvalCase.vendor, `${approvalCase.id} needs a vendor`);
    assert.ok(approvalCase.department, `${approvalCase.id} needs a department`);
    assert.ok(approvalCase.requestedBy, `${approvalCase.id} needs a requester`);
    assert.equal(
      approvalCase.containsProductionData,
      false,
      `${approvalCase.id} must stay synthetic`,
    );
    assert.equal(typeof approvalCase.amount, "number", `${approvalCase.id} amount is numeric`);
    assert.ok(approvalCase.amount > 0, `${approvalCase.id} amount must be positive`);
    assert.match(approvalCase.currency, /^[A-Z]{3}$/, `${approvalCase.id} uses currency code`);
    assert.ok(
      allowedStatuses.has(approvalCase.approvalStatus),
      `${approvalCase.id} status is invalid`,
    );
    assert.ok(Array.isArray(approvalCase.riskFlags), `${approvalCase.id} risk flags are listed`);
    assert.equal(typeof approvalCase.reviewRequired, "boolean");
    assert.ok(approvalCase.nextAction, `${approvalCase.id} needs a next action`);

    if (approvalCase.approvalStatus === "ready-for-approval") {
      assert.equal(
        approvalCase.reviewRequired,
        false,
        `${approvalCase.id} ready approvals should not require review`,
      );
      assert.equal(approvalCase.riskFlags.length, 0, `${approvalCase.id} should have no flags`);
    }

    if (approvalCase.approvalStatus === "blocked") {
      assert.equal(
        approvalCase.riskFlags.some((flag) => flag.startsWith("missing-")),
        true,
        `${approvalCase.id} blocked cases need missing detail flags`,
      );
      assert.equal(approvalCase.reviewRequired, true);
    }

    if (approvalCase.approvalStatus === "rejected") {
      assert.equal(
        approvalCase.riskFlags.includes("duplicate-invoice") ||
          approvalCase.riskFlags.includes("policy-violation"),
        true,
        `${approvalCase.id} rejected cases need a rejection reason`,
      );
      assert.equal(approvalCase.reviewRequired, true);
    }

    if (approvalCase.riskFlags.includes("manager-threshold")) {
      assert.equal(
        approvalCase.approvalStatus,
        "needs-review",
        `${approvalCase.id} manager threshold cases should need review`,
      );
    }

    seenStatuses.add(approvalCase.approvalStatus);
    seenIds.add(approvalCase.id);
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
      "node --test tools/v2/team/invoice-approval-workflow/tests/invoice-approval-docs.test.mjs",
    ),
  );
  assert.ok(readme.includes("tools/v2/team/invoice-approval-workflow/"));
  assert.ok(specs.includes("ready-for-approval"));
  assert.ok(specs.includes("Do not add payment execution"));
  assert.ok(testPlan.includes("Manual Review Checklist"));
  assert.ok(testPlan.includes("no production data"));
  assert.ok(reviewNotes.includes("Out Of Scope"));
  assert.ok(reviewNotes.toLowerCase().includes("integration"));
});
