import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const currentDir = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(currentDir, "..", "fixtures", "sample-task-emails.json");

const allowedPriorities = new Set(["low", "medium", "high"]);
const allowedStatuses = new Set(["new", "triage", "blocked", "done"]);
const requiredStatuses = ["new", "triage", "blocked", "done"];

async function loadFixture() {
  const raw = await readFile(fixturePath, "utf8");
  return JSON.parse(raw);
}

test("sample task email fixture follows the local board contract", async () => {
  const fixture = await loadFixture();

  assert.equal(fixture.tool, "team-task-board-from-emails");
  assert.ok(Array.isArray(fixture.emails), "emails must be an array");
  assert.ok(Array.isArray(fixture.expectedCards), "expectedCards must be an array");
  assert.equal(fixture.emails.length, fixture.expectedCards.length);

  const emailIds = new Set(fixture.emails.map((email) => email.id));
  const seenStatuses = new Set();

  for (const card of fixture.expectedCards) {
    assert.ok(card.id, "card needs a stable id");
    assert.ok(card.title, `${card.id} needs a title`);
    assert.ok(card.owner, `${card.id} needs an owner or unassigned`);
    assert.ok(allowedPriorities.has(card.priority), `${card.id} has invalid priority`);
    assert.ok(allowedStatuses.has(card.status), `${card.id} has invalid status`);
    assert.ok(emailIds.has(card.sourceEmailId), `${card.id} source email is missing`);

    if (card.dueDate !== null) {
      assert.match(card.dueDate, /^\d{4}-\d{2}-\d{2}$/, `${card.id} dueDate must be ISO date`);
    }

    if (card.status === "blocked") {
      assert.equal(card.reviewRequired, true, "blocked cards must require review");
    }

    if (card.owner === "unassigned") {
      assert.equal(card.reviewRequired, true, "unassigned cards must require review");
    }

    seenStatuses.add(card.status);
  }

  for (const status of requiredStatuses) {
    assert.ok(seenStatuses.has(status), `fixture must include ${status} status`);
  }
});
