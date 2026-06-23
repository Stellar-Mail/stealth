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
  const raw = await readLocal("fixtures/sample-escalations.json");
  return JSON.parse(raw);
}

test("README documents local reviewer setup", async () => {
  const readme = await readLocal("README.md");

  assert.match(readme, /tools\/v2\/team\/escalation-tool\//);
  assert.match(readme, /documentation-contract\.test\.mjs/);
  assert.match(readme, /Known Limitations/);
  assert.match(readme, /No live notifications/);
});

test("specs do not contain generated placeholder fragments", async () => {
  const specs = await readLocal("specs.md");

  for (const placeholder of ["Hashtable", "$dir", "Set-Content", "    ests/"]) {
    assert.doesNotMatch(specs, new RegExp(placeholder.replace("$", "\\$")));
  }

  assert.match(specs, /Contributor Boundary/);
  assert.match(specs, /Required Local Behavior/);
  assert.match(specs, /Recommended Future Structure/);
});

test("sample escalation fixture covers required states", async () => {
  const fixture = await loadFixture();

  assert.equal(fixture.tool, "escalation-tool");
  assert.ok(Array.isArray(fixture.states));
  assert.ok(Array.isArray(fixture.requests));

  const expectedStates = ["queued", "assigned", "escalated", "resolved", "blocked"];
  const seenStates = new Set(fixture.requests.map((request) => request.state));

  for (const state of expectedStates) {
    assert.ok(fixture.states.includes(state), `states must list ${state}`);
    assert.ok(seenStates.has(state), `requests must include ${state}`);
  }
});

test("sample escalation requests are reviewable and synthetic", async () => {
  const fixture = await loadFixture();

  for (const request of fixture.requests) {
    assert.ok(request.id, "request needs stable id");
    assert.ok(request.conversationId, `${request.id} needs conversation id`);
    assert.ok(request.subject, `${request.id} needs subject`);
    assert.ok(["low", "medium", "high", "critical"].includes(request.severity));
    assert.ok(Array.isArray(request.signals), `${request.id} needs signals`);
    assert.ok(request.expectedAction, `${request.id} needs expected action`);

    if (request.assignee) {
      assert.match(request.assignee, /\.test$/);
    }

    if (request.state === "blocked") {
      assert.equal(request.ownerTeam, "");
      assert.match(request.expectedAction, /owner/i);
    }
  }
});

test("test plan and review notes explain independent validation", async () => {
  const testPlan = await readLocal("docs/test-plan.md");
  const reviewNotes = await readLocal("docs/review-notes.md");

  assert.match(testPlan, /Automated Check/);
  assert.match(testPlan, /Manual Review Checklist/);
  assert.match(testPlan, /Out Of Scope/);
  assert.match(reviewNotes, /How To Review/);
  assert.match(reviewNotes, /Known Limitations/);
  assert.match(reviewNotes, /Safety Notes/);
  assert.match(reviewNotes, /No live network calls/);
});
