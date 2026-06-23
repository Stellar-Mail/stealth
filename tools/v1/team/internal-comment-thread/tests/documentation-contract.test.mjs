import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const toolRoot = path.resolve(__dirname, "..");

async function readToolFile(relativePath) {
  return readFile(path.join(toolRoot, relativePath), "utf8");
}

test("documentation covers setup, usage, fixtures, limitations, and review commands", async () => {
  const testPlan = await readToolFile("docs/TEST_PLAN.md");
  const usage = await readToolFile("docs/USAGE.md");
  const limitations = await readToolFile("docs/KNOWN_LIMITATIONS.md");

  for (const term of ["Core Behavior Coverage", "UI And Accessibility Coverage", "Contributor Validation Commands"]) {
    assert.match(testPlan, new RegExp(term));
  }

  for (const term of ["Local Setup", "Review Fixture", "Expected Workflow", "Review Checklist"]) {
    assert.match(usage, new RegExp(term));
  }

  assert.match(limitations, /No main application integration is included/);
  assert.match(limitations, /No production inbox data/);
});

test("fixture models message and thread internal comments", async () => {
  const fixture = JSON.parse(await readToolFile("fixtures/sample-internal-comment-thread.json"));
  const targetKinds = new Set(fixture.targets.map((target) => target.kind));
  const commentCount = fixture.targets.reduce((sum, target) => sum + target.comments.length, 0);

  assert.ok(targetKinds.has("message"));
  assert.ok(targetKinds.has("thread"));
  assert.equal(commentCount, 3);
});

test("external payload sample excludes internal comment body text", async () => {
  const fixture = JSON.parse(await readToolFile("fixtures/sample-internal-comment-thread.json"));
  const internalBodies = fixture.targets.flatMap((target) =>
    target.comments.map((comment) => comment.body),
  );
  const externalPayload = JSON.stringify(fixture.externalPayloadSample);

  assert.equal(fixture.externalPayloadSample.commentBodiesIncluded, false);

  for (const body of internalBodies) {
    assert.doesNotMatch(externalPayload, new RegExp(body.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("fixture remains synthetic and avoids sensitive fields", async () => {
  const fixtureText = await readToolFile("fixtures/sample-internal-comment-thread.json");
  const fixture = JSON.parse(fixtureText);

  assert.equal(fixture.teamRoster.every((address) => address.endsWith(".test")), true);
  assert.equal(fixture.externalPayloadSample.to.endsWith(".test"), true);
  assert.doesNotMatch(fixtureText, /password|secret|token|bank|card|wallet|seed/i);
});

test("documentation states isolation from app-wide systems", async () => {
  const combined = [
    await readToolFile("docs/TEST_PLAN.md"),
    await readToolFile("docs/USAGE.md"),
    await readToolFile("docs/KNOWN_LIMITATIONS.md"),
  ].join("\n");

  for (const boundary of [
    "main app shell",
    "routing",
    "wallet",
    "Stellar core",
    "database",
    "shared design system",
  ]) {
    assert.match(combined, new RegExp(boundary, "i"));
  }
});

test("documentation avoids generated template residue", async () => {
  const combined = [
    await readToolFile("docs/TEST_PLAN.md"),
    await readToolFile("docs/USAGE.md"),
    await readToolFile("docs/KNOWN_LIMITATIONS.md"),
  ].join("\n");

  assert.doesNotMatch(combined, /System\.Collections|Set-Content|@\s*\||\$dir|\$\(.*\)/);
});
