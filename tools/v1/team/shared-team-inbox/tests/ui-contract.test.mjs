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

test("shared team inbox UI remains isolated to the tool folder", async () => {
  const files = await listFiles();
  const uiFiles = files.filter((file) => file.includes(`${path.sep}components${path.sep}`));

  assert.ok(uiFiles.length >= 7, "expected folder-local UI components");

  for (const file of files) {
    assert.ok(
      file.startsWith(toolRoot),
      `file escaped the shared team inbox tool folder: ${file}`,
    );
  }

  const source = await Promise.all(
    uiFiles
      .filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"))
      .map((file) => readFile(file, "utf8")),
  );
  const combined = source.join("\n");

  assert.doesNotMatch(combined, /from\s+["']src\//);
  assert.doesNotMatch(combined, /from\s+["']\.\.\/\.\.\/\.\./);
  assert.doesNotMatch(combined, /from\s+["']tools\//);
});

test("primary UI exposes empty, loading, error, success, and message list states", async () => {
  const componentIndex = await readToolFile("components/index.ts");
  const mainComponent = await readToolFile("components/SharedTeamInbox.tsx");

  for (const exportName of [
    "SharedInboxEmptyState",
    "SharedInboxLoadingState",
    "SharedInboxErrorState",
    "SharedInboxSuccessState",
    "SharedInboxMessageCard",
    "SharedInboxSummary",
    "SharedTeamInbox",
  ]) {
    assert.match(componentIndex, new RegExp(`export \\{ ${exportName} \\}`));
  }

  assert.match(mainComponent, /<SharedInboxLoadingState/);
  assert.match(mainComponent, /<SharedInboxErrorState/);
  assert.match(mainComponent, /<SharedInboxSuccessState/);
  assert.match(mainComponent, /<SharedInboxEmptyState/);
  assert.match(mainComponent, /role="list"/);
  assert.match(mainComponent, /role="listitem"/);
});

test("interactive controls include labels and keyboard-friendly focus behavior", async () => {
  const mainComponent = await readToolFile("components/SharedTeamInbox.tsx");
  const cardComponent = await readToolFile("components/SharedInboxMessageCard.tsx");
  const errorState = await readToolFile("components/SharedInboxErrorState.tsx");
  const successState = await readToolFile("components/SharedInboxSuccessState.tsx");

  assert.match(mainComponent, /type="radio"/);
  assert.match(mainComponent, /aria-label="Filter shared inbox by status"/);
  assert.match(mainComponent, /className="sr-only"/);
  assert.match(cardComponent, /role="group"/);
  assert.match(cardComponent, /aria-label=\{`Actions for \$\{message\.subject\}`\}/);
  assert.match(cardComponent, /aria-label=\{`\$\{hasAssignee \? "Release" : "Claim"\}/);
  assert.match(cardComponent, /aria-label=\{`Open shared inbox message/);
  assert.match(cardComponent, /aria-label=\{`Reply to/);

  for (const source of [cardComponent, errorState, successState]) {
    assert.match(source, /focus-visible:ring-2/);
  }
});

test("status presentation is text-labelled and fixture covers every workflow state", async () => {
  const cardComponent = await readToolFile("components/SharedInboxMessageCard.tsx");
  const fixture = JSON.parse(await readToolFile("fixtures/sample-shared-inbox-ui.json"));
  const statuses = new Set(fixture.messages.map((message) => message.status));

  for (const status of ["unassigned", "claimed", "in-progress", "awaiting-reply", "resolved"]) {
    assert.ok(statuses.has(status), `fixture should include ${status}`);
  }

  assert.match(cardComponent, /Message status:/);
  assert.match(cardComponent, /statusLabels/);
  assert.match(cardComponent, /statusClasses/);
});

test("fixture data is synthetic and avoids sensitive payment or credential fields", async () => {
  const fixtureText = await readToolFile("fixtures/sample-shared-inbox-ui.json");
  const fixture = JSON.parse(fixtureText);

  assert.equal(fixture.summary.total, fixture.messages.length);
  assert.equal(fixture.messages.every((message) => message.senderAddress.endsWith(".test")), true);
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
  assert.match(visualStyle, /Status Treatment/);
  assert.match(visualStyle, /Responsive Behavior/);
});
