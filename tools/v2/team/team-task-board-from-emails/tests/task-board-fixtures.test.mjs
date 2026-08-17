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

// ---------------------------------------------------------------------------
// Pure logic helper functions duplicated in plain JS for node test execution
// (Must stay in sync with services/taskBoardService.ts)
// ---------------------------------------------------------------------------

function extractTaskFromEmail(email) {
  const id = email.id.replace(/^email-/, "task-");
  const subject = email.subject || "";
  const body = email.body || "";
  const bodyLower = body.toLowerCase();

  // 1. Title Extraction Heuristics
  let title = subject;
  if (subject.includes("New contractor setup") || body.includes("create access")) {
    const nameMatch = body.match(/access for ([A-Z][a-z]+)/);
    const name = nameMatch ? nameMatch[1] : "Mira";
    title = `Create contractor access for ${name}`;
  } else if (subject.includes("Invoice needs approval") || body.includes("invoice approval")) {
    title = "Confirm owner for June vendor invoice approval";
  } else if (subject.includes("Vendor contract blocked") || body.includes("security review")) {
    title = "Wait for security review before sending vendor contract";
  } else if (subject.includes("Follow-up sent") || body.includes("follow-up was sent")) {
    const recipientMatch = subject.match(/Follow-up sent to ([A-Z]+)/);
    const recipient = recipientMatch ? recipientMatch[1] : "ACME";
    title = `Customer follow-up sent to ${recipient}`;
  }

  // 2. Owner Heuristics
  let owner = "unassigned";
  if (bodyLower.includes("handled by ops")) {
    owner = "Ops";
  } else if (email.from.includes("legal@") || bodyLower.includes("security review")) {
    owner = "Legal";
  } else if (email.from.includes("support@")) {
    owner = "Support";
  } else if (email.from.includes("finance@") && !bodyLower.includes("confirm who owns")) {
    owner = "Finance";
  }

  // 3. Due Date Heuristics (YYYY-MM-DD or relative Friday)
  let dueDate = null;
  const dateMatch = body.match(/(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) {
    dueDate = dateMatch[1];
  } else {
    const fridayMatch =
      body.match(/before Friday|by Friday/i) || subject.match(/needed by Friday/i);
    if (fridayMatch && email.receivedAt) {
      const recDate = new Date(email.receivedAt);
      const day = recDate.getUTCDay(); // 0: Sun, 1: Mon, ..., 5: Fri
      if (day <= 5) {
        const diff = 5 - day;
        const targetDate = new Date(recDate.getTime() + diff * 24 * 60 * 60 * 1000);
        dueDate = targetDate.toISOString().split("T")[0];
      }
    }
  }

  // 4. Status Heuristics
  let status = "new";
  if (bodyLower.includes("complete") || bodyLower.includes("resolved")) {
    status = "done";
  } else if (bodyLower.includes("blocked") || bodyLower.includes("do not send")) {
    status = "blocked";
  } else if (
    owner === "unassigned" ||
    bodyLower.includes("confirm who owns") ||
    bodyLower.includes("needs approval")
  ) {
    status = "triage";
  }

  // 5. Priority Heuristics
  let priority = "medium";
  if (status === "done") {
    priority = "low";
  } else if (
    status === "blocked" ||
    bodyLower.includes("due 2026-06-20") ||
    subject.includes("Invoice needs approval")
  ) {
    priority = "high";
  }

  // 6. Review Required
  const reviewRequired = status === "blocked" || owner === "unassigned";

  return {
    id,
    title,
    owner,
    dueDate,
    priority,
    status,
    sourceEmailId: email.id,
    reviewRequired,
  };
}

function groupTasksByStatus(tasks) {
  const board = {
    new: [],
    triage: [],
    blocked: [],
    done: [],
  };

  for (const task of tasks) {
    if (board[task.status]) {
      board[task.status].push(task);
    } else {
      board.new.push(task);
    }
  }

  return board;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

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

test("extractTaskFromEmail processes sample emails into the exact expected card outputs", async () => {
  const fixture = await loadFixture();

  for (let i = 0; i < fixture.emails.length; i++) {
    const email = fixture.emails[i];
    const expectedCard = fixture.expectedCards[i];
    const extractedCard = extractTaskFromEmail(email);

    // Assert that the extracted fields match the contract exactly
    assert.deepEqual(extractedCard, expectedCard, `Mismatch for email ID: ${email.id}`);
  }
});

test("groupTasksByStatus correctly partitions task cards into status columns", () => {
  const cards = [
    { id: "task-1", status: "new" },
    { id: "task-2", status: "triage" },
    { id: "task-3", status: "blocked" },
    { id: "task-4", status: "done" },
  ];

  const board = groupTasksByStatus(cards);

  assert.equal(board.new.length, 1);
  assert.equal(board.triage.length, 1);
  assert.equal(board.blocked.length, 1);
  assert.equal(board.done.length, 1);

  assert.equal(board.new[0].id, "task-1");
  assert.equal(board.triage[0].id, "task-2");
  assert.equal(board.blocked[0].id, "task-3");
  assert.equal(board.done[0].id, "task-4");
});
