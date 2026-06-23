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

test("fixture models claim, release, reassignment, and escalation scenarios", async () => {
  const fixture = JSON.parse(await readToolFile("fixtures/sample-ownership-history.json"));
  const actions = new Set(
    fixture.messages.flatMap((message) => message.events.map((event) => event.action)),
  );

  for (const action of ["claimed", "released", "reassigned", "escalated"]) {
    assert.ok(actions.has(action), `fixture should include ${action}`);
  }

  assert.equal(fixture.messages.length, 3);
});

test("fixture remains synthetic and avoids sensitive fields", async () => {
  const fixtureText = await readToolFile("fixtures/sample-ownership-history.json");
  const fixture = JSON.parse(fixtureText);

  assert.equal(
    fixture.messages.every((message) => message.sharedInboxAddress.endsWith(".test")),
    true,
  );
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
