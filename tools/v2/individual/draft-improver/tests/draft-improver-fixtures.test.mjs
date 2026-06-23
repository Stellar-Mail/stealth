import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const fixturePath = new URL("../fixtures/sample-drafts.json", import.meta.url);

test("sample draft fixtures document reviewable improvement cases", async () => {
  const fixtures = JSON.parse(await readFile(fixturePath, "utf8"));

  assert.ok(Array.isArray(fixtures), "fixtures must be an array");
  assert.ok(fixtures.length >= 3, "include at least three review scenarios");

  const ids = new Set();

  for (const item of fixtures) {
    assert.equal(typeof item.id, "string");
    assert.match(item.id, /^[a-z0-9-]+$/);
    assert.ok(!ids.has(item.id), `duplicate fixture id: ${item.id}`);
    ids.add(item.id);

    assert.equal(typeof item.scenario, "string");
    assert.ok(item.scenario.length > 20);
    assert.equal(typeof item.inputDraft, "string");
    assert.equal(typeof item.suggestedDraft, "string");
    assert.notEqual(item.inputDraft, item.suggestedDraft);

    assert.ok(Array.isArray(item.improvementGoals));
    assert.ok(item.improvementGoals.length >= 2);
    assert.ok(item.improvementGoals.every((goal) => /^[a-z_]+$/.test(goal)));

    assert.ok(Array.isArray(item.reviewChecks));
    assert.ok(item.reviewChecks.length >= 2);
    assert.ok(item.reviewChecks.every((check) => typeof check === "string" && check.length > 10));
  }
});
