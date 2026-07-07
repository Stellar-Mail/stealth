import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const currentDir = dirname(fileURLToPath(import.meta.url));
const toolDir = join(currentDir, "..");
const fixturePath = join(toolDir, "fixtures", "review-scenarios.json");
const testPlanPath = join(toolDir, "docs", "test-plan.md");
const reviewNotesPath = join(toolDir, "docs", "review-notes.md");

const supportedLanguages = new Set(["auto", "en", "es", "fr", "de", "pt"]);
const allowedStates = new Set([
  "ready-for-translation",
  "needs-source-review",
  "unsupported-language",
  "blocked-input",
]);
const requiredStates = [
  "ready-for-translation",
  "needs-source-review",
  "unsupported-language",
  "blocked-input",
];

async function readJson(path) {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw);
}

test("email translator review scenarios follow the fixture contract", async () => {
  const fixture = await readJson(fixturePath);

  assert.equal(fixture.tool, "email-translator");
  assert.match(fixture.runContext.now, /^\d{4}-\d{2}-\d{2}T/);
  assert.ok(Array.isArray(fixture.scenarios), "scenarios must be an array");
  assert.ok(fixture.scenarios.length >= requiredStates.length);

  const seenIds = new Set();
  const seenStates = new Set();

  for (const scenario of fixture.scenarios) {
    assert.ok(scenario.id, "scenario needs a stable id");
    assert.equal(seenIds.has(scenario.id), false, `${scenario.id} is duplicated`);
    assert.ok(supportedLanguages.has(scenario.sourceLanguage), `${scenario.id} source invalid`);
    assert.ok(scenario.targetLanguage, `${scenario.id} target is required`);
    assert.ok(scenario.sourceText, `${scenario.id} source text is required`);
    assert.equal(scenario.containsProductionData, false, `${scenario.id} must stay synthetic`);
    assert.ok(allowedStates.has(scenario.expectedState), `${scenario.id} state is invalid`);
    assert.equal(typeof scenario.reviewRequired, "boolean");
    assert.ok(Array.isArray(scenario.riskFlags), `${scenario.id} risk flags are listed`);

    if (scenario.expectedState === "ready-for-translation") {
      assert.equal(scenario.reviewRequired, false, `${scenario.id} should be ready`);
      assert.equal(scenario.riskFlags.length, 0, `${scenario.id} should have no risk flags`);
    }

    if (scenario.expectedState === "needs-source-review") {
      assert.equal(scenario.sourceLanguage, "auto", `${scenario.id} uses auto detection`);
      assert.equal(scenario.reviewRequired, true);
      assert.ok(scenario.riskFlags.includes("auto-detect-source"));
    }

    if (scenario.expectedState === "unsupported-language") {
      assert.equal(
        supportedLanguages.has(scenario.targetLanguage),
        false,
        `${scenario.id} target should be unsupported`,
      );
      assert.equal(scenario.reviewRequired, true);
    }

    if (scenario.expectedState === "blocked-input") {
      assert.ok(
        scenario.riskFlags.includes("active-content-marker"),
        `${scenario.id} needs active content flag`,
      );
      assert.equal(scenario.reviewRequired, true);
    }

    seenIds.add(scenario.id);
    seenStates.add(scenario.expectedState);
  }

  for (const state of requiredStates) {
    assert.ok(seenStates.has(state), `fixture must include ${state}`);
  }
});

test("email translator documentation exposes setup and isolation boundaries", async () => {
  const [testPlan, reviewNotes] = await Promise.all([
    readFile(testPlanPath, "utf8"),
    readFile(reviewNotesPath, "utf8"),
  ]);

  assert.ok(
    testPlan.includes(
      "node --test tools/v2/individual/email-translator/tests/email-translator-docs.test.mjs",
    ),
  );
  assert.ok(testPlan.includes("Manual Review Checklist"));
  assert.ok(testPlan.includes("no production data"));
  assert.ok(testPlan.includes("Future Code Coverage"));
  assert.ok(reviewNotes.includes("Out Of Scope"));
  assert.ok(reviewNotes.includes("live translation API calls"));
  assert.ok(reviewNotes.toLowerCase().includes("integration"));
  assert.ok(reviewNotes.includes("tool read from a mailbox"));
});
