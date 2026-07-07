import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const currentDir = dirname(fileURLToPath(import.meta.url));
const toolDir = join(currentDir, "..");
const componentPath = join(toolDir, "components", "LegalComplianceReviewFlag.tsx");
const fixturePath = join(toolDir, "fixtures", "ui-review-cases.json");
const accessibilityPath = join(toolDir, "docs", "ACCESSIBILITY.md");
const visualStylePath = join(toolDir, "docs", "VISUAL_STYLE.md");

async function readJson(path) {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw);
}

test("UI fixture covers all review surface states", async () => {
  const fixture = await readJson(fixturePath);

  assert.equal(fixture.tool, "legal-and-compliance-review-flag");
  assert.deepEqual(fixture.states, ["loading", "error", "empty", "success"]);
  assert.ok(fixture.items.length >= 3);

  for (const item of fixture.items) {
    assert.ok(item.id);
    assert.ok(item.subject);
    assert.ok(item.requester);
    assert.ok(item.department);
    assert.ok(["low", "medium", "high", "critical"].includes(item.severity));
    assert.ok(["pending", "needs-review", "approved", "blocked"].includes(item.status));
    assert.ok(item.reason);
    assert.match(item.receivedAt, /^\d{4}-\d{2}-\d{2}T/);
  }
});

test("component exposes accessible landmarks, states, and controls", async () => {
  const source = await readFile(componentPath, "utf8");

  for (const expected of [
    'role="status"',
    'role="alert"',
    'aria-live="polite"',
    'aria-live="assertive"',
    "aria-label",
    "aria-pressed",
    'role="group"',
    "focus-visible:ring-2",
    'type="button"',
  ]) {
    assert.ok(source.includes(expected), `${expected} is required`);
  }

  for (const state of ["loading", "error", "empty", "success"]) {
    assert.ok(source.includes(state), `${state} state is missing`);
  }

  for (const action of ["Approve", "Escalate", "Dismiss", "Retry"]) {
    assert.ok(source.includes(action), `${action} action is missing`);
  }
});

test("accessibility and style docs describe isolated UI expectations", async () => {
  const [accessibility, visualStyle] = await Promise.all([
    readFile(accessibilityPath, "utf8"),
    readFile(visualStylePath, "utf8"),
  ]);

  assert.ok(accessibility.includes("Screen Reader Support"));
  assert.ok(accessibility.includes("Keyboard Support"));
  assert.ok(accessibility.includes("This UI is not mounted into the main app"));
  assert.ok(visualStyle.includes("compliance console"));
  assert.ok(visualStyle.includes("The shared design system is not changed"));
});
