import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const testDir = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(testDir, "..", "fixtures", "approval-scenarios.json");
const allowedStates = new Set([
  "pending_review",
  "needs_information",
  "approved",
  "rejected",
  "blocked"
]);

async function loadScenarios() {
  const raw = await readFile(fixturePath, "utf8");
  return JSON.parse(raw);
}

describe("Invoice Approval Workflow fixtures", () => {
  it("define deterministic review scenarios for future local tests", async () => {
    const scenarios = await loadScenarios();

    assert.equal(Array.isArray(scenarios), true);
    assert.ok(scenarios.length >= 5, "expected broad review-state coverage");

    const ids = new Set();
    const states = new Set();
    const currencies = new Set();

    for (const scenario of scenarios) {
      assert.match(scenario.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      assert.equal(ids.has(scenario.id), false, `duplicate id: ${scenario.id}`);
      ids.add(scenario.id);

      assert.equal(typeof scenario.title, "string");
      assert.ok(scenario.title.length > 12);

      assert.equal(typeof scenario.invoice.vendor, "string");
      assert.ok(scenario.invoice.vendor.length > 2);
      assert.equal(typeof scenario.invoice.amount, "number");
      assert.ok(scenario.invoice.amount > 0, `${scenario.id} amount must be positive`);
      assert.match(scenario.invoice.currency, /^[A-Z]{3}$/);
      assert.match(scenario.invoice.dueDate, /^\d{4}-\d{2}-\d{2}$/);
      assert.equal(typeof scenario.invoice.purchaseOrder, "string");
      currencies.add(scenario.invoice.currency);

      assert.equal(Array.isArray(scenario.reviewSignals), true);
      assert.ok(
        scenario.reviewSignals.length >= 3,
        `${scenario.id} should name at least three review signals`
      );

      assert.ok(
        allowedStates.has(scenario.expectedState),
        `${scenario.id} has unsupported state ${scenario.expectedState}`
      );
      states.add(scenario.expectedState);
    }

    for (const state of allowedStates) {
      assert.ok(states.has(state), `missing ${state} scenario`);
    }

    assert.ok(currencies.has("USD"), "expected USD invoice coverage");
    assert.ok(currencies.size >= 2, "expected at least one non-USD invoice");
  });
});
