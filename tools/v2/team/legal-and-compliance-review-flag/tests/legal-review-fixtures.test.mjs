import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dir = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(__dir, "..", "fixtures", "legal-review-items.json");

const ALLOWED_RISK_AREAS = new Set([
  "privacy",
  "contract",
  "regulatory",
  "marketing",
  "employment",
  "finance",
  "other",
]);

const ALLOWED_SEVERITIES = new Set(["critical", "high", "medium", "low"]);
const ALLOWED_STATUSES = new Set([
  "needs-legal-review",
  "needs-compliance-review",
  "approved-with-notes",
  "blocked",
  "monitoring",
]);
const ALLOWED_REVIEW_OWNERS = new Set(["legal", "compliance", "security", "finance", "ops"]);

async function loadFixture() {
  return JSON.parse(await readFile(fixturePath, "utf8"));
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function assertReservedExampleEmail(value, fieldName) {
  assert.match(
    value,
    /^[^@\s]+@(?:[a-z0-9-]+\.)*example\.(?:com|net|org)$/i,
    `${fieldName} must use a reserved example domain`,
  );
}

test("fixture metadata describes the isolated tool", async () => {
  const data = await loadFixture();

  assert.equal(data.metadata.tool, "legal-and-compliance-review-flag");
  assert.equal(data.metadata.scope, "folder-local");
  assert.equal(data.metadata.fixtureVersion, 1);
  assert.ok(Array.isArray(data.metadata.dataPolicy));
  assert.ok(
    data.metadata.dataPolicy.some((entry) => entry.includes("Synthetic")),
    "data policy should identify the examples as synthetic",
  );
});

test("review items have stable IDs, required fields, and unique references", async () => {
  const { reviewItems } = await loadFixture();

  assert.ok(Array.isArray(reviewItems));
  assert.ok(reviewItems.length >= 6, "expected broad enough review coverage");

  const ids = new Set();
  const threadIds = new Set();
  const emailIds = new Set();

  for (const item of reviewItems) {
    for (const field of [
      "id",
      "threadId",
      "emailId",
      "subject",
      "sender",
      "requester",
      "jurisdiction",
      "riskArea",
      "severity",
      "status",
      "recommendedAction",
    ]) {
      assert.ok(isNonEmptyString(item[field]), `${item.id ?? "item"} missing ${field}`);
    }

    assert.match(item.id, /^legal-review-\d{3}$/);
    assert.match(item.threadId, /^thread-[a-z0-9-]+-\d{3}$/);
    assert.match(item.emailId, /^email-[a-z0-9-]+-\d{3}$/);

    assert.equal(ids.has(item.id), false, `duplicate id ${item.id}`);
    assert.equal(threadIds.has(item.threadId), false, `duplicate threadId ${item.threadId}`);
    assert.equal(emailIds.has(item.emailId), false, `duplicate emailId ${item.emailId}`);

    ids.add(item.id);
    threadIds.add(item.threadId);
    emailIds.add(item.emailId);
  }
});

test("review item enums stay inside the documented contract", async () => {
  const { reviewItems } = await loadFixture();

  for (const item of reviewItems) {
    assert.ok(ALLOWED_RISK_AREAS.has(item.riskArea), `${item.id} has unknown riskArea`);
    assert.ok(ALLOWED_SEVERITIES.has(item.severity), `${item.id} has unknown severity`);
    assert.ok(ALLOWED_STATUSES.has(item.status), `${item.id} has unknown status`);
  }
});

test("fixture examples use reserved domains and avoid real addresses", async () => {
  const { reviewItems } = await loadFixture();

  for (const item of reviewItems) {
    assertReservedExampleEmail(item.sender, `${item.id}.sender`);
    assertReservedExampleEmail(item.requester, `${item.id}.requester`);
  }
});

test("high-risk review items include enough reviewer context", async () => {
  const { reviewItems } = await loadFixture();

  for (const item of reviewItems) {
    assert.ok(Array.isArray(item.signals), `${item.id} signals must be an array`);
    assert.ok(item.signals.every(isNonEmptyString), `${item.id} signals must be non-empty`);

    if (item.severity === "critical" || item.severity === "high") {
      assert.ok(item.signals.length >= 2, `${item.id} needs at least two review signals`);
      assert.match(
        item.status,
        /^needs-(legal|compliance)-review$/,
        `${item.id} high-risk item should stay in a review queue status`,
      );
    }
  }
});

test("fixtures cover expected legal and compliance review areas", async () => {
  const { reviewItems } = await loadFixture();
  const areas = new Set(reviewItems.map((item) => item.riskArea));

  for (const requiredArea of ["privacy", "contract", "regulatory", "marketing"]) {
    assert.ok(areas.has(requiredArea), `missing ${requiredArea} fixture coverage`);
  }
});

test("routing rules are valid and map to covered fixture statuses", async () => {
  const { reviewItems, routingRules } = await loadFixture();

  assert.ok(Array.isArray(routingRules));
  assert.ok(routingRules.length >= 4, "expected legal/compliance routing coverage");

  for (const rule of routingRules) {
    assert.ok(isNonEmptyString(rule.id), "routing rule needs an id");
    assert.ok(ALLOWED_RISK_AREAS.has(rule.riskArea), `${rule.id} has unknown riskArea`);
    assert.ok(ALLOWED_SEVERITIES.has(rule.minimumSeverity), `${rule.id} has unknown severity`);
    assert.ok(ALLOWED_REVIEW_OWNERS.has(rule.reviewOwner), `${rule.id} has unknown owner`);
    assert.ok(ALLOWED_STATUSES.has(rule.expectedStatus), `${rule.id} has unknown status`);

    const matchingItem = reviewItems.find(
      (item) => item.riskArea === rule.riskArea && item.status === rule.expectedStatus,
    );
    assert.ok(matchingItem, `${rule.id} should be backed by at least one fixture item`);
  }
});
