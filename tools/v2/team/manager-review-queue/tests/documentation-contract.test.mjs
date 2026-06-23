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
  const raw = await readLocal("fixtures/sample-review-requests.json");
  return JSON.parse(raw);
}

test("README documents isolated reviewer setup", async () => {
  const readme = await readLocal("README.md");

  assert.match(readme, /tools\/v2\/team\/manager-review-queue\//);
  assert.match(readme, /review-guards\.test\.mjs/);
  assert.match(readme, /documentation-contract\.test\.mjs/);
  assert.match(readme, /Known Limitations/);
  assert.match(readme, /no network calls/i);
});

test("specs do not contain generated placeholder fragments", async () => {
  const specs = await readLocal("specs.md");

  for (const placeholder of ["Hashtable", "$dir", "Set-Content", "    ests/"]) {
    assert.doesNotMatch(specs, new RegExp(placeholder.replace("$", "\\$")));
  }

  assert.match(specs, /Contributor Boundary/);
  assert.match(specs, /Required Local Behavior/);
  assert.match(specs, /tests\/` for standalone Node tests/);
});

test("fixture contains valid, hostile, and edge-case coverage", async () => {
  const fixture = await loadFixture();

  assert.ok(Array.isArray(fixture.validRequests));
  assert.ok(Array.isArray(fixture.hostileInputs));
  assert.ok(Array.isArray(fixture.edgeCases));
  assert.ok(fixture.validRequests.length >= 3);
  assert.ok(fixture.hostileInputs.length >= 8);
  assert.ok(fixture.edgeCases.length >= 4);

  for (const request of fixture.validRequests) {
    assert.match(request.submitterEmail, /\.test$/);
    assert.ok(request.reviewId);
    assert.ok(request.status);
    assert.ok(request.priority);
  }
});

test("test plan documents automated and manual validation", async () => {
  const testPlan = await readLocal("docs/test-plan.md");

  assert.match(testPlan, /Automated Checks/);
  assert.match(testPlan, /Manual Review Checklist/);
  assert.match(testPlan, /review-guards\.test\.mjs/);
  assert.match(testPlan, /documentation-contract\.test\.mjs/);
  assert.match(testPlan, /Out Of Scope/);
});

test("review notes cover safety boundaries and limitations", async () => {
  const reviewNotes = await readLocal("docs/review-notes.md");

  assert.match(reviewNotes, /How To Review/);
  assert.match(reviewNotes, /Known Limitations/);
  assert.match(reviewNotes, /Safety Notes/);
  assert.match(reviewNotes, /No secrets/);
  assert.match(reviewNotes, /No live network calls/);
});
