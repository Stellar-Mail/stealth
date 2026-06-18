import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const currentDir = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(currentDir, "..", "fixtures", "sample-task-extractions.json");

const allowedPriorities = new Set(["high", "medium", "low"]);
const allowedStatuses = new Set(["pending", "completed", "blocked"]);
const requiredPriorities = ["high", "medium", "low"];

async function loadFixture() {
  const raw = await readFile(fixturePath, "utf8");
  return JSON.parse(raw);
}

test("sample task extraction fixture follows the local extraction contract", async () => {
  const fixture = await loadFixture();

  assert.equal(fixture.tool, "task-extractor");
  assert.ok(Array.isArray(fixture.sourceEmails), "sourceEmails must be an array");
  assert.ok(Array.isArray(fixture.expectedExtractions), "expectedExtractions must be an array");
  assert.ok(fixture.sourceEmails.length > 0, "fixture must have source emails");
  assert.ok(fixture.expectedExtractions.length > 0, "fixture must have expected extractions");

  const emailIds = new Set(fixture.sourceEmails.map((email) => email.id));
  const emailsById = new Map(fixture.sourceEmails.map((email) => [email.id, email]));
  const seenPriorities = new Set();

  // Validate source emails
  for (const email of fixture.sourceEmails) {
    assert.ok(email.id, "email needs a stable id");
    assert.ok(email.from, "email needs a from address");
    assert.ok(email.subject, "email needs a subject");
    assert.ok(email.body, "email needs a body");
    assert.ok(email.timestamp, "email needs a timestamp");
  }

  // Validate expected extractions
  for (const task of fixture.expectedExtractions) {
    assert.ok(task.taskId, "task needs a stable id");
    assert.ok(task.sourceEmailId, "task needs a source email id");
    assert.ok(emailIds.has(task.sourceEmailId), `task source email is missing`);
    assert.ok(task.extractedTask, `${task.taskId} needs extracted task text`);
    assert.ok(allowedPriorities.has(task.priority), `${task.taskId} has invalid priority`);
    assert.ok(allowedStatuses.has(task.status), `${task.taskId} has invalid status`);
    assert.ok(task.context, `${task.taskId} needs context`);

    seenPriorities.add(task.priority);
  }

  // Verify all priority levels are represented
  for (const priority of requiredPriorities) {
    assert.ok(seenPriorities.has(priority), `fixture must include ${priority} priority`);
  }

  // Verify extraction rules are defined
  assert.ok(fixture.extractionRules, "fixture must define extraction rules");
  assert.ok(Array.isArray(fixture.extractionRules.priorities), "extraction rules must list allowed priorities");
  assert.ok(Array.isArray(fixture.extractionRules.statuses), "extraction rules must list allowed statuses");
});

test("tasks are correctly mapped to source emails", async () => {
  const fixture = await loadFixture();
  const emailsById = new Map(fixture.sourceEmails.map((email) => [email.id, email]));

  for (const task of fixture.expectedExtractions) {
    const sourceEmail = emailsById.get(task.sourceEmailId);
    assert.ok(sourceEmail, `source email ${task.sourceEmailId} exists`);
    
    // Task should be extractable from the email body
    assert.ok(
      sourceEmail.body.toLowerCase().includes(task.extractedTask.toLowerCase()) ||
        sourceEmail.subject.toLowerCase().includes(task.extractedTask.toLowerCase()),
      `task "${task.extractedTask}" should be traceable to email body or subject`
    );
  }
});

test("priority levels are correctly assigned", async () => {
  const fixture = await loadFixture();

  const highPriorityTasks = fixture.expectedExtractions.filter((t) => t.priority === "high");
  const mediumPriorityTasks = fixture.expectedExtractions.filter((t) => t.priority === "medium");
  const lowPriorityTasks = fixture.expectedExtractions.filter((t) => t.priority === "low");

  assert.ok(highPriorityTasks.length > 0, "fixture should include high priority tasks");
  assert.ok(mediumPriorityTasks.length > 0, "fixture should include medium priority tasks");
  assert.ok(lowPriorityTasks.length > 0, "fixture should include low priority tasks");

  // HIGH priority should be clearly marked (e.g., bug fixes, critical items)
  const highPriorityExample = highPriorityTasks[0];
  assert.ok(
    highPriorityExample.extractedTask.toLowerCase().includes("bug") ||
      highPriorityExample.extractedTask.toLowerCase().includes("critical") ||
      highPriorityExample.extractedTask.toLowerCase().includes("high priority"),
    "high priority task should be clearly marked in content"
  );
});
