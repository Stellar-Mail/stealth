import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const currentDir = dirname(fileURLToPath(import.meta.url));
const toolDir = join(currentDir, "..");
const componentPath = join(toolDir, "components", "MailToTicketConverterSurface.tsx");
const fixturePath = join(toolDir, "fixtures", "ui-ticket-cases.json");
const accessibilityPath = join(toolDir, "docs", "ACCESSIBILITY.md");
const visualStylePath = join(toolDir, "docs", "VISUAL_STYLE.md");

async function readJson(path) {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw);
}

test("UI fixture covers all mail-to-ticket surface states", async () => {
  const fixture = await readJson(fixturePath);

  assert.equal(fixture.tool, "mail-to-ticket-converter");
  assert.deepEqual(fixture.states, ["loading", "error", "empty", "success"]);
  assert.ok(fixture.items.length >= 3);

  for (const item of fixture.items) {
    assert.ok(item.id);
    assert.ok(item.subject);
    assert.ok(item.sender);
    assert.ok(item.queue);
    assert.ok(["low", "normal", "high", "urgent"].includes(item.priority));
    assert.ok(["draft", "needs-triage", "ready", "blocked"].includes(item.status));
    assert.ok(item.summary);
    assert.ok(item.recommendedAssignee);
    assert.match(item.receivedAt, /^\d{4}-\d{2}-\d{2}T/);
  }
});

test("component exposes accessible states and native controls", async () => {
  const source = await readFile(componentPath, "utf8");

  for (const expected of [
    'role="status"',
    'role="alert"',
    'aria-live="polite"',
    'aria-live="assertive"',
    "aria-label",
    "aria-current",
    'role="group"',
    "focus-visible:ring-2",
    'type="button"',
  ]) {
    assert.ok(source.includes(expected), `${expected} is required`);
  }

  for (const state of ["loading", "error", "empty", "success"]) {
    assert.ok(source.includes(state), `${state} state is missing`);
  }

  for (const action of ["Create Ticket", "Ask for Context", "Dismiss Draft", "Retry"]) {
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
  assert.ok(visualStyle.includes("ticket triage console"));
  assert.ok(visualStyle.includes("The shared design system is not changed"));
});
