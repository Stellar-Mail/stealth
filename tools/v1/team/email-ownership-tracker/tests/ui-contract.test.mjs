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
  const raw = await readLocal("fixtures/sample-ownership.json");
  return JSON.parse(raw);
}

test("sample ownership fixture follows the local UI contract", async () => {
  const fixture = await loadFixture();

  assert.equal(fixture.tool, "email-ownership-tracker");
  assert.ok(Array.isArray(fixture.records));
  assert.equal(fixture.records.length, 4);

  const statuses = new Set();

  for (const record of fixture.records) {
    assert.ok(record.id, "record needs a stable id");
    assert.ok(record.messageId, `${record.id} needs message id`);
    assert.ok(record.subject, `${record.id} needs subject`);
    assert.ok(record.senderLabel, `${record.id} needs sender label`);
    assert.ok(["unassigned", "owned", "stale", "resolved"].includes(record.status));
    assert.ok(record.team, `${record.id} needs team`);
    assert.equal(typeof record.ageMinutes, "number");
    assert.ok(record.lastAction, `${record.id} needs last action`);

    if (record.owner) {
      assert.match(record.owner, /\.test$/);
    }

    statuses.add(record.status);
  }

  for (const status of ["unassigned", "owned", "stale", "resolved"]) {
    assert.ok(statuses.has(status), `fixture must include ${status}`);
  }
});

test("loading, error, and empty states expose screen-reader roles", async () => {
  const loadingState = await readLocal("components/OwnershipLoadingState.tsx");
  const errorState = await readLocal("components/OwnershipErrorState.tsx");
  const emptyState = await readLocal("components/OwnershipEmptyState.tsx");

  assert.match(loadingState, /role="status"/);
  assert.match(loadingState, /aria-live="polite"/);
  assert.match(loadingState, /aria-busy="true"/);
  assert.match(errorState, /role="alert"/);
  assert.match(errorState, /type="button"/);
  assert.match(emptyState, /role="status"/);
  assert.match(emptyState, /aria-label="No ownership records"/);
});

test("tracker uses native filters and labelled result list", async () => {
  const tracker = await readLocal("components/EmailOwnershipTracker.tsx");

  assert.match(tracker, /aria-labelledby="email-ownership-title"/);
  assert.match(tracker, /<fieldset/);
  assert.match(tracker, /<legend className="sr-only">Ownership status filter<\/legend>/);
  assert.match(tracker, /type="radio"/);
  assert.match(tracker, /name="email-ownership-filter"/);
  assert.match(tracker, /role="list"/);
  assert.match(tracker, /role="listitem"/);
});

test("ownership cards label icon-backed controls", async () => {
  const card = await readLocal("components/OwnershipRecordCard.tsx");

  assert.match(card, /aria-label=\{`Claim ownership of \$\{record\.subject\}`\}/);
  assert.match(card, /aria-label=\{`Transfer ownership of \$\{record\.subject\}`\}/);
  assert.match(card, /aria-label=\{`Release ownership of \$\{record\.subject\}`\}/);
  assert.match(card, /aria-hidden="true"/);
  assert.match(card, /type="button"/);
});

test("component barrel exports the local UI surface", async () => {
  const index = await readLocal("components/index.ts");

  for (const exportName of [
    "EmailOwnershipTracker",
    "OwnershipEmptyState",
    "OwnershipErrorState",
    "OwnershipLoadingState",
    "OwnershipRecordCard",
    "OwnershipSummary",
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
  assert.match(visualStyle, /unassigned/);
  assert.match(visualStyle, /owned/);
  assert.match(visualStyle, /stale/);
  assert.match(visualStyle, /resolved/);
});
