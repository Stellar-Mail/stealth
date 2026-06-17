import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const currentDir = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(currentDir, "..", "fixtures", "sample-payment-approvals.json");

const allowedStatuses = new Set(["submitted", "needs-review", "blocked", "approved"]);
const requiredStatuses = ["submitted", "needs-review", "blocked", "approved"];

async function loadFixture() {
  const raw = await readFile(fixturePath, "utf8");
  return JSON.parse(raw);
}

test("sample payment approval fixture follows the local review contract", async () => {
  const fixture = await loadFixture();

  assert.equal(fixture.tool, "team-payment-approval");
  assert.ok(Array.isArray(fixture.sourceRecords), "sourceRecords must be an array");
  assert.ok(Array.isArray(fixture.expectedApprovals), "expectedApprovals must be an array");
  assert.equal(fixture.sourceRecords.length, fixture.expectedApprovals.length);

  const sourceIds = new Set(fixture.sourceRecords.map((record) => record.id));
  const sourceById = new Map(fixture.sourceRecords.map((record) => [record.id, record]));
  const seenStatuses = new Set();

  for (const approval of fixture.expectedApprovals) {
    assert.ok(approval.id, "approval needs a stable id");
    assert.ok(approval.vendor, `${approval.id} needs a vendor`);
    assert.ok(approval.requester, `${approval.id} needs a requester`);
    assert.equal(typeof approval.amount, "number", `${approval.id} amount must be numeric`);
    assert.ok(approval.amount > 0, `${approval.id} amount must be positive`);
    assert.match(approval.currency, /^[A-Z]{3}$/, `${approval.id} currency must be uppercase code`);
    assert.ok(allowedStatuses.has(approval.status), `${approval.id} has invalid status`);
    assert.ok(sourceIds.has(approval.sourceRecordId), `${approval.id} source record is missing`);
    assert.ok(Array.isArray(approval.requiredApprovers), `${approval.id} approvers must be an array`);
    assert.ok(approval.requiredApprovers.length > 0, `${approval.id} needs at least one approver`);

    if (approval.amount >= 5000) {
      assert.ok(
        approval.requiredApprovers.includes("finance"),
        `${approval.id} high-value approvals must include finance`,
      );
      assert.equal(approval.reviewRequired, true, `${approval.id} high-value approvals require review`);
    }

    if (approval.status === "blocked" || approval.status === "needs-review") {
      assert.equal(approval.reviewRequired, true, `${approval.id} must require review`);
    }

    const source = sourceById.get(approval.sourceRecordId);
    if (source && source.hasSupportingDocument === false) {
      assert.equal(approval.status, "blocked", `${approval.id} missing documents must be blocked`);
    }

    seenStatuses.add(approval.status);
  }

  for (const status of requiredStatuses) {
    assert.ok(seenStatuses.has(status), `fixture must include ${status} status`);
  }
});
