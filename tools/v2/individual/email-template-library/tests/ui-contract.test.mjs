import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const toolRoot = path.resolve(__dirname, "..");

async function listFiles(dir = toolRoot) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const absolute = path.join(dir, entry.name);
      return entry.isDirectory() ? listFiles(absolute) : absolute;
    }),
  );

  return files.flat();
}

async function readToolFile(relativePath) {
  return readFile(path.join(toolRoot, relativePath), "utf8");
}

test("template library UI remains isolated to the tool folder", async () => {
  const files = await listFiles();
  const uiFiles = files.filter((file) => file.includes(`${path.sep}components${path.sep}`));

  assert.ok(uiFiles.length >= 8, "expected folder-local UI components");

  for (const file of files) {
    assert.ok(file.startsWith(toolRoot), `file escaped the email template tool folder: ${file}`);
  }

  const source = await Promise.all(
    uiFiles
      .filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"))
      .map((file) => readFile(file, "utf8")),
  );
  const combined = source.join("\n");

  assert.doesNotMatch(combined, /from\s+["']src\//);
  assert.doesNotMatch(combined, /from\s+["']tools\//);
  assert.doesNotMatch(combined, /from\s+["']\.\.\/\.\.\/\.\./);
});

test("primary UI exposes empty, loading, error, success, list, and preview states", async () => {
  const componentIndex = await readToolFile("components/index.ts");
  const mainComponent = await readToolFile("components/EmailTemplateLibrary.tsx");

  for (const exportName of [
    "EmailTemplateLibrary",
    "TemplateCard",
    "TemplateLibraryEmptyState",
    "TemplateLibraryLoadingState",
    "TemplateLibraryErrorState",
    "TemplateLibrarySuccessState",
    "TemplatePreviewPanel",
  ]) {
    assert.match(componentIndex, new RegExp(`export \\{ ${exportName} \\}`));
  }

  assert.match(mainComponent, /<TemplateLibraryLoadingState/);
  assert.match(mainComponent, /<TemplateLibraryErrorState/);
  assert.match(mainComponent, /<TemplateLibrarySuccessState/);
  assert.match(mainComponent, /<TemplateLibraryEmptyState/);
  assert.match(mainComponent, /<TemplatePreviewPanel/);
  assert.match(mainComponent, /role="list"/);
  assert.match(mainComponent, /role="listitem"/);
});

test("interactive controls include labels and keyboard-friendly focus behavior", async () => {
  const mainComponent = await readToolFile("components/EmailTemplateLibrary.tsx");
  const cardComponent = await readToolFile("components/TemplateCard.tsx");
  const emptyState = await readToolFile("components/TemplateLibraryEmptyState.tsx");
  const errorState = await readToolFile("components/TemplateLibraryErrorState.tsx");

  assert.match(mainComponent, /aria-label="Create new email template"/);
  assert.match(cardComponent, /role="group"/);
  assert.match(cardComponent, /aria-label=\{`Actions for template/);
  assert.match(cardComponent, /aria-pressed=\{selected\}/);
  assert.match(cardComponent, /aria-label=\{`Preview email template/);
  assert.match(cardComponent, /aria-label=\{`Copy email template/);
  assert.match(cardComponent, /aria-label=\{`Edit email template/);

  for (const source of [mainComponent, cardComponent, emptyState, errorState]) {
    assert.match(source, /focus-visible:ring-2/);
  }
});

test("fixture covers template list, variables, stats, and preview output", async () => {
  const fixture = JSON.parse(await readToolFile("fixtures/sample-template-library-ui.json"));
  const templateIds = new Set(fixture.templates.map((template) => template.id));

  assert.equal(fixture.stats.totalTemplates, fixture.templates.length);
  assert.ok(templateIds.has(fixture.selectedTemplateId));
  assert.equal(fixture.templates.every((template) => template.variables.length > 0), true);
  assert.equal(typeof fixture.preview.subject, "string");
  assert.equal(Array.isArray(fixture.preview.missingVariables), true);
});

test("fixture data is synthetic and avoids sensitive fields", async () => {
  const fixtureText = await readToolFile("fixtures/sample-template-library-ui.json");

  assert.doesNotMatch(fixtureText, /password|secret|token|bank|card|wallet|seed/i);
});

test("accessibility and visual documentation cover review expectations", async () => {
  const accessibility = await readToolFile("docs/ACCESSIBILITY.md");
  const visualStyle = await readToolFile("docs/VISUAL_STYLE.md");

  for (const term of ["Keyboard Operation", "Screen Reader Support", "focus-visible", "role=\"alert\""]) {
    assert.match(accessibility, new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(visualStyle, /Do not change the shared design system/);
  assert.match(visualStyle, /8px radius/);
  assert.match(visualStyle, /Responsive Behavior/);
});
