import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const testDir = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(testDir, "..", "fixtures", "review-scenarios.json");

async function loadScenarios() {
  const raw = await readFile(fixturePath, "utf8");
  return JSON.parse(raw);
}

describe("Email Translator review fixtures", () => {
  it("provide deterministic coverage for future service, hook, and UI tests", async () => {
    const scenarios = await loadScenarios();

    assert.equal(Array.isArray(scenarios), true);
    assert.ok(scenarios.length >= 5, "expected success and error review scenarios");

    const ids = new Set();
    const uiStates = new Set();
    const languagePairs = new Set();

    for (const scenario of scenarios) {
      assert.match(scenario.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      assert.equal(ids.has(scenario.id), false, `duplicate id: ${scenario.id}`);
      ids.add(scenario.id);

      assert.equal(typeof scenario.title, "string");
      assert.ok(scenario.title.length > 10);

      assert.match(scenario.sourceLanguage, /^[a-z]{2,3}$/);
      assert.match(scenario.targetLanguage, /^[a-z]{2,3}$/);
      assert.notEqual(
        scenario.sourceLanguage,
        scenario.targetLanguage,
        `${scenario.id} should translate between different languages`
      );
      languagePairs.add(`${scenario.sourceLanguage}:${scenario.targetLanguage}`);

      assert.equal(typeof scenario.sourceText, "string");
      assert.equal(Array.isArray(scenario.expectedReviewFocus), true);
      assert.ok(
        scenario.expectedReviewFocus.length >= 3,
        `${scenario.id} should name at least three review expectations`
      );
      assert.equal(Array.isArray(scenario.uiStates), true);
      assert.ok(scenario.uiStates.length > 0, `${scenario.id} should name UI states`);

      for (const state of scenario.uiStates) {
        uiStates.add(state);
      }
    }

    assert.ok(languagePairs.size >= 4, "expected multiple language pairs");
    assert.ok(uiStates.has("success"), "expected success state coverage");
    assert.ok(uiStates.has("error"), "expected error state coverage");
    assert.ok(uiStates.has("copy-ready"), "expected copy-ready state coverage");
    assert.ok(uiStates.has("empty"), "expected empty state coverage");
  });
});
