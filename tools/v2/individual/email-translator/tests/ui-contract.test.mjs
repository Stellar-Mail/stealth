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
  const raw = await readLocal("fixtures/sample-translations.json");
  return JSON.parse(raw);
}

test("sample translations fixture follows the local UI contract", async () => {
  const fixture = await loadFixture();

  assert.equal(fixture.tool, "email-translator");
  assert.ok(Array.isArray(fixture.languages));
  assert.ok(Array.isArray(fixture.results));
  assert.ok(fixture.languages.some((language) => language.code === "auto"));

  const statuses = new Set();

  for (const result of fixture.results) {
    assert.ok(result.id, "translation result needs a stable id");
    assert.ok(result.subject, `${result.id} needs a subject`);
    assert.ok(result.sourceLanguage, `${result.id} needs a source language`);
    assert.ok(result.targetLanguage, `${result.id} needs a target language`);
    assert.ok(result.sourceText, `${result.id} needs source text`);
    assert.ok(["translated", "needs-review", "blocked"].includes(result.status));
    assert.equal(typeof result.confidence, "number");
    assert.ok(result.confidence >= 0 && result.confidence <= 1);
    assert.ok(Array.isArray(result.preservedElements));
    assert.ok(Array.isArray(result.warnings));

    if (result.status === "translated") {
      assert.ok(result.translatedText, `${result.id} translated output is missing`);
      assert.ok(result.confidence >= 0.9, `${result.id} confidence should be high`);
    }

    if (result.status === "needs-review") {
      assert.ok(result.warnings.length > 0, `${result.id} should explain review need`);
    }

    if (result.status === "blocked") {
      assert.equal(result.translatedText, "", `${result.id} blocked output should be empty`);
      assert.ok(result.warnings.length > 0, `${result.id} should explain block reason`);
    }

    statuses.add(result.status);
  }

  for (const status of ["translated", "needs-review", "blocked"]) {
    assert.ok(statuses.has(status), `fixture must include ${status}`);
  }
});

test("loading, error, and empty states expose screen-reader roles", async () => {
  const loadingState = await readLocal("components/EmailTranslatorLoadingState.tsx");
  const errorState = await readLocal("components/EmailTranslatorErrorState.tsx");
  const emptyState = await readLocal("components/EmailTranslatorEmptyState.tsx");

  assert.match(loadingState, /role="status"/);
  assert.match(loadingState, /aria-live="polite"/);
  assert.match(loadingState, /aria-busy="true"/);
  assert.match(errorState, /role="alert"/);
  assert.match(errorState, /type="button"/);
  assert.match(emptyState, /role="status"/);
  assert.match(emptyState, /aria-label="No translation results"/);
});

test("shell uses labelled language controls and native filters", async () => {
  const shell = await readLocal("components/EmailTranslatorShell.tsx");
  const selector = await readLocal("components/LanguageSelector.tsx");

  assert.match(shell, /aria-labelledby="email-translator-title"/);
  assert.match(shell, /id="email-translator-source-language"/);
  assert.match(shell, /id="email-translator-target-language"/);
  assert.match(shell, /<fieldset/);
  assert.match(shell, /<legend className="sr-only">Translation result filter<\/legend>/);
  assert.match(shell, /type="radio"/);
  assert.match(shell, /name="email-translator-filter"/);
  assert.match(shell, /role="list"/);
  assert.match(shell, /role="listitem"/);
  assert.match(selector, /<label/);
  assert.match(selector, /htmlFor=\{id\}/);
  assert.match(selector, /<select/);
});

test("result cards and copy controls are keyboard and screen-reader friendly", async () => {
  const card = await readLocal("components/TranslationResultCard.tsx");
  const copyButton = await readLocal("components/CopyTranslationButton.tsx");

  assert.match(card, /aria-label=\{`Review translation for \$\{result\.subject\}`\}/);
  assert.match(card, /type="button"/);
  assert.match(card, /aria-hidden="true"/);
  assert.match(copyButton, /aria-live="polite"/);
  assert.match(copyButton, /type="button"/);
  assert.match(copyButton, /navigator\.clipboard\.writeText/);
});

test("component barrel exports the local UI surface", async () => {
  const index = await readLocal("components/index.ts");

  for (const exportName of [
    "CopyTranslationButton",
    "EmailTranslatorEmptyState",
    "EmailTranslatorErrorState",
    "EmailTranslatorLoadingState",
    "EmailTranslatorShell",
    "EmailTranslatorSummary",
    "LanguageSelector",
    "TranslationResultCard",
  ]) {
    assert.match(index, new RegExp(`\\b${exportName}\\b`));
  }
});

test("documentation covers focus, keyboard, screen-reader, and status colors", async () => {
  const accessibility = await readLocal("docs/ACCESSIBILITY.md");
  const visualStyle = await readLocal("docs/VISUAL_STYLE.md");

  assert.match(accessibility, /Keyboard Behavior/);
  assert.match(accessibility, /Screen Reader Names/);
  assert.match(accessibility, /focus/i);
  assert.match(visualStyle, /translated/);
  assert.match(visualStyle, /needs-review/);
  assert.match(visualStyle, /blocked/);
});
