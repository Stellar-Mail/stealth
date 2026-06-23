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

test("loading, error, and empty states expose screen-reader roles", async () => {
  const loadingState = await readLocal("components/MacroToolLoadingState.tsx");
  const errorState = await readLocal("components/MacroToolErrorState.tsx");
  const emptyState = await readLocal("components/MacroToolEmptyState.tsx");

  assert.match(loadingState, /role="status"/);
  assert.match(loadingState, /aria-live="polite"/);
  assert.match(loadingState, /aria-busy="true"/);
  assert.match(errorState, /role="alert"/);
  assert.match(errorState, /type="button"/);
  assert.match(emptyState, /role="status"/);
  assert.match(emptyState, /aria-label="No support macros"/);
});

test("macro panel uses labelled search, native filters, and labelled result list", async () => {
  const panel = await readLocal("components/MacroToolPanel.tsx");

  assert.match(panel, /aria-labelledby="support-macro-tool-title"/);
  assert.match(panel, /htmlFor="macro-search"/);
  assert.match(panel, /type="search"/);
  assert.match(panel, /<fieldset/);
  assert.match(panel, /<legend className="sr-only">Macro category filter<\/legend>/);
  assert.match(panel, /type="radio"/);
  assert.match(panel, /name="macro-category-filter"/);
  assert.match(panel, /role="list"/);
  assert.match(panel, /role="listitem"/);
});

test("macro card labels icon-backed controls", async () => {
  const card = await readLocal("components/MacroCard.tsx");

  assert.match(card, /aria-label=\{`Apply macro \$\{macro\.title\}`\}/);
  assert.match(card, /aria-label=\{`\$\{macro\.isFavorite \? "Remove favorite from" : "Favorite"\} \$\{macro\.title\}`\}/);
  assert.match(card, /aria-label=\{`Edit macro \$\{macro\.title\}`\}/);
  assert.match(card, /aria-hidden="true"/);
  assert.match(card, /type="button"/);
});

test("component barrel exports the local UI surface", async () => {
  const index = await readLocal("components/index.ts");

  for (const exportName of [
    "MacroCard",
    "MacroSummary",
    "MacroToolEmptyState",
    "MacroToolErrorState",
    "MacroToolLoadingState",
    "MacroToolPanel",
  ]) {
    assert.match(index, new RegExp(`\\b${exportName}\\b`));
  }
});

test("documentation covers focus, keyboard, screen-reader, and visual states", async () => {
  const accessibility = await readLocal("docs/ACCESSIBILITY.md");
  const visualStyle = await readLocal("docs/VISUAL_STYLE.md");

  assert.match(accessibility, /Keyboard Behavior/);
  assert.match(accessibility, /Screen Reader Names/);
  assert.match(accessibility, /focus/i);
  assert.match(visualStyle, /Color System/);
  assert.match(visualStyle, /Favorite/);
});
