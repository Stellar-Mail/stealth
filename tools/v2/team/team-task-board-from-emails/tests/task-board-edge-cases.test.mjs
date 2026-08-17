import test from "node:test";
import assert from "node:assert/strict";

import {
  extractTaskFromEmail,
  groupTasksByStatus,
} from "../services/task-board-execution.service.mjs";

function email(overrides) {
  return {
    id: "email-1",
    threadId: "thread-1",
    from: "person@example.test",
    to: [],
    subject: "Status update",
    body: "Just a routine note.",
    receivedAt: "2026-06-17T09:00:00Z",
    ...overrides,
  };
}

test("title falls back to Mira when contractor access has no named recipient", () => {
  const card = extractTaskFromEmail(
    email({ subject: "New contractor setup", body: "Please create access soon." }),
  );
  assert.equal(card.title, "Create contractor access for Mira");
});

test("title falls back to ACME when a follow-up names no uppercase recipient", () => {
  const card = extractTaskFromEmail(email({ subject: "Follow-up sent to the team" }));
  assert.equal(card.title, "Customer follow-up sent to ACME");
});

test("finance sender stays unassigned when the body asks to confirm who owns it", () => {
  const card = extractTaskFromEmail(
    email({ from: "finance@acme.test", body: "Please confirm who owns this invoice." }),
  );
  assert.equal(card.owner, "unassigned");
  assert.equal(card.status, "triage");
  assert.equal(card.reviewRequired, true);
});

test("relative by Friday resolves to that week's Friday date", () => {
  const card = extractTaskFromEmail(
    email({ body: "Please respond by Friday.", receivedAt: "2026-06-17T09:00:00Z" }),
  );
  assert.equal(card.dueDate, "2026-06-19");
});

test("relative Friday yields no due date when the email arrives on a Saturday", () => {
  const card = extractTaskFromEmail(
    email({ body: "Please handle this by Friday.", receivedAt: "2026-06-20T09:00:00Z" }),
  );
  assert.equal(card.dueDate, null);
});

test("resolved wording marks the task done with low priority", () => {
  const card = extractTaskFromEmail(email({ body: "This request is now resolved." }));
  assert.equal(card.status, "done");
  assert.equal(card.priority, "low");
});

test("groupTasksByStatus routes unknown statuses into the new column in order", () => {
  const cards = [
    { id: "task-1", status: "new" },
    { id: "task-2", status: "archived" },
    { id: "task-3", status: "new" },
  ];
  const board = groupTasksByStatus(cards);
  assert.deepEqual(
    board.new.map((c) => c.id),
    ["task-1", "task-2", "task-3"],
  );
  assert.equal(board.triage.length, 0);
  assert.equal(board.blocked.length, 0);
  assert.equal(board.done.length, 0);
});
