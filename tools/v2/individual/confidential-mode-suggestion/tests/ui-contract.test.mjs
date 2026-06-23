import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const currentDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(currentDir, "..");

async function readLocal(relativePath) {
  return readFile(join(rootDir, relativePath), "utf8");
}

async function loadFixture() {
  const raw = await readLocal("fixtures/sample-suggestions.json");
  return JSON.parse(raw);
}

test("sample suggestions fixture follows the local UI contract", async () => {
  const fixture = await loadFixture();

  assert.equal(fixture.tool, "confidential-mode-suggestion");
  assert.ok(Array.isArray(fixture.suggestions));
  assert.equal(fixture.suggestions.length, 3);

  const statuses = new Set();

  for (const suggestion of fixture.suggestions) {
    assert.ok(suggestion.id, "suggestion needs a stable id");
    assert.ok(suggestion.draftTitle, `${suggestion.id} needs a draft title`);
    assert.ok(suggestion.recipientLabel, `${suggestion.id} needs a recipient label`);
    assert.ok(["suggested", "blocked", "safe"].includes(suggestion.status));
    assert.ok(
      ["confidential-mode", "manual-review", "standard-send"].includes(
        suggestion.recommendedMode,
      ),
    );
    assert.equal(typeof suggestion.preventForwarding, "boolean");
    assert.equal(typeof suggestion.requirePasscode, "boolean");
    assert.ok(Array.isArray(suggestion.signals));
    assert.ok(suggestion.signals.length >= 1, `${suggestion.id} needs at least one signal`);
    assert.ok(suggestion.reason, `${suggestion.id} needs a reason`);
    assert.ok(suggestion.suggestedAction, `${suggestion.id} needs a suggested action`);

    for (const signal of suggestion.signals) {
      assert.ok(signal.id, `${suggestion.id} signal needs an id`);
      assert.ok(signal.label, `${suggestion.id} signal needs a label`);
      assert.ok(["high", "medium", "low"].includes(signal.severity));
      assert.ok(signal.evidence, `${suggestion.id} signal needs evidence`);
    }

    statuses.add(suggestion.status);
  }

  for (const status of ["suggested", "blocked", "safe"]) {
    assert.ok(statuses.has(status), `fixture must include ${status}`);
  }
});

test("loading, error, and empty states expose screen-reader roles", async () => {
  const loadingState = await readLocal("components/ConfidentialModeLoadingState.tsx");
  const errorState = await readLocal("components/ConfidentialModeErrorState.tsx");
  const emptyState = await readLocal("components/ConfidentialModeEmptyState.tsx");

  assert.match(loadingState, /role="status"/);
  assert.match(loadingState, /aria-live="polite"/);
  assert.match(loadingState, /aria-busy="true"/);
  assert.match(errorState, /role="alert"/);
  assert.match(errorState, /type="button"/);
  assert.match(emptyState, /role="status"/);
  assert.match(emptyState, /aria-label="No confidential-mode suggestions"/);
});

test("ready tool uses native filters and labelled result list", async () => {
  const tool = await readLocal("components/ConfidentialModeSuggestionTool.tsx");

  assert.match(tool, /aria-labelledby="confidential-mode-title"/);
  assert.match(tool, /<fieldset/);
  assert.match(tool, /<legend className="sr-only">Confidential-mode suggestion filter<\/legend>/);
  assert.match(tool, /type="radio"/);
  assert.match(tool, /name="confidential-mode-filter"/);
  assert.match(tool, /role="list"/);
  assert.match(tool, /role="listitem"/);
});

test("suggestion card labels icon-backed controls", async () => {
  const card = await readLocal("components/ConfidentialSuggestionCard.tsx");

  assert.match(card, /aria-label=\{`Apply confidential mode to \$\{suggestion\.draftTitle\}`\}/);
  assert.match(
    card,
    /aria-label=\{`Dismiss privacy suggestion for \$\{suggestion\.draftTitle\}`\}/,
  );
  assert.match(card, /aria-hidden="true"/);
  assert.match(card, /type="button"/);
  assert.match(card, /aria-label=\{`Privacy signals for \$\{suggestion\.draftTitle\}`\}/);
});

test("component barrel exports the local UI surface", async () => {
  const index = await readLocal("components/index.ts");

  for (const exportName of [
    "ConfidentialModeEmptyState",
    "ConfidentialModeErrorState",
    "ConfidentialModeLoadingState",
    "ConfidentialModeSuggestionTool",
    "ConfidentialModeSummary",
    "ConfidentialSuggestionCard",
  ]) {
    assert.match(index, new RegExp(`\\b${exportName}\\b`));
  }
});

test("documentation covers focus, keyboard, screen-reader, and color states", async () => {
  const accessibility = await readLocal("docs/ACCESSIBILITY.md");
  const visualStyle = await readLocal("docs/VISUAL_STYLE.md");

  assert.match(accessibility, /Keyboard Behavior/);
  assert.match(accessibility, /Screen Reader Names/);
  assert.match(accessibility, /focus/i);
  assert.match(visualStyle, /suggested/);
  assert.match(visualStyle, /blocked/);
  assert.match(visualStyle, /safe/);
});
