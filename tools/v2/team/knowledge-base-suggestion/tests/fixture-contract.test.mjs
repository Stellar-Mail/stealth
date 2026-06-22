import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const testDir = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(testDir, "..", "fixtures", "suggestion-scenarios.json");
const allowedOutcomes = new Set([
  "suggested",
  "needs_review",
  "duplicate",
  "rejected",
  "blocked"
]);

async function loadScenarios() {
  const raw = await readFile(fixturePath, "utf8");
  return JSON.parse(raw);
}

describe("Knowledge Base Suggestion fixtures", () => {
  it("define deterministic suggestion scenarios for future local tests", async () => {
    const scenarios = await loadScenarios();

    assert.equal(Array.isArray(scenarios), true);
    assert.ok(scenarios.length >= 5, "expected broad suggestion outcome coverage");

    const ids = new Set();
    const outcomes = new Set();
    const sections = new Set();

    for (const scenario of scenarios) {
      assert.match(scenario.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      assert.equal(ids.has(scenario.id), false, `duplicate id: ${scenario.id}`);
      ids.add(scenario.id);

      assert.equal(typeof scenario.title, "string");
      assert.ok(scenario.title.length > 12);
      assert.equal(typeof scenario.sourceContext, "string");
      assert.ok(scenario.sourceContext.length > 30);

      assert.match(scenario.targetArticle.slug, /^[a-z0-9]+(?:[/-][a-z0-9]+)*$/);
      assert.equal(typeof scenario.targetArticle.section, "string");
      assert.ok(scenario.targetArticle.section.length > 2);
      assert.equal(typeof scenario.targetArticle.exists, "boolean");
      sections.add(scenario.targetArticle.section);

      assert.equal(Array.isArray(scenario.reviewSignals), true);
      assert.ok(
        scenario.reviewSignals.length >= 3,
        `${scenario.id} should name at least three review signals`
      );

      assert.ok(
        allowedOutcomes.has(scenario.expectedOutcome),
        `${scenario.id} has unsupported outcome ${scenario.expectedOutcome}`
      );
      outcomes.add(scenario.expectedOutcome);
    }

    for (const outcome of allowedOutcomes) {
      assert.ok(outcomes.has(outcome), `missing ${outcome} scenario`);
    }

    assert.ok(sections.size >= 4, "expected several target article sections");
  });
});
