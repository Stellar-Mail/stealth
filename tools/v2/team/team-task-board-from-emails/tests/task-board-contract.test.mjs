import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  validateCreateTaskInput,
  validateEmail,
  isAuthorized,
} from "../guards/task-board-guards.mjs";
import { TaskBoardError, TaskBoardErrorCode } from "../guards/task-board-errors.mjs";
import {
  createTaskBoardExecutor,
  extractTaskFromEmail,
  groupTasksByStatus,
} from "../services/task-board-execution.service.mjs";

const currentDir = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(currentDir, "..", "fixtures");

async function loadJson(fileName) {
  const raw = await readFile(join(fixturesDir, fileName), "utf8");
  return JSON.parse(raw);
}

test("TaskBoardError carries a stable machine-readable code", () => {
  const error = new TaskBoardError(TaskBoardErrorCode.MALFORMED_EMAIL, "boom");
  assert.ok(error instanceof Error);
  assert.equal(error.name, "TaskBoardError");
  assert.equal(error.code, "MALFORMED_EMAIL");
});

test("documented error codes are unique and self-consistent", () => {
  const codes = Object.values(TaskBoardErrorCode);
  assert.equal(new Set(codes).size, codes.length, "error codes must be unique");
  for (const [key, value] of Object.entries(TaskBoardErrorCode)) {
    assert.equal(key, value, "error code key and value should match");
  }
});

test("valid email fixture is converted into the exact expected cards", async () => {
  const fixture = await loadJson("sample-task-emails-contract.json");

  for (let i = 0; i < fixture.emails.length; i++) {
    const email = fixture.emails[i];
    const expectedCard = fixture.expectedCards[i];

    const result = createTaskBoardExecutor().createTaskFromEmail({ email });
    assert.equal(result.ok, true, "expected success for " + email.id);
    assert.deepEqual(result.data, expectedCard, "Mismatch for email ID: " + email.id);
  }
});

test("groupTasksByStatus partitions cards into the four board columns", () => {
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
});

test("invalid input payloads raise the documented error codes", async () => {
  const fixture = await loadJson("invalid-task-board-data.json");
  for (const testCase of fixture.invalidInputCases) {
    assert.throws(
      () => validateCreateTaskInput(testCase.input),
      (error) => error instanceof TaskBoardError && error.code === testCase.expectedErrorCode,
      "expected " + testCase.expectedErrorCode + " for case " + testCase.name,
    );
  }
});

test("malformed emails raise MALFORMED_EMAIL with the offending field", async () => {
  const fixture = await loadJson("invalid-task-board-data.json");
  for (const testCase of fixture.malformedEmailCases) {
    let caught;
    try {
      validateEmail(testCase.input.email);
    } catch (error) {
      caught = error;
    }
    assert.ok(caught instanceof TaskBoardError, "case " + testCase.name + " should throw");
    assert.equal(caught.code, testCase.expectedErrorCode, "case " + testCase.name);
    assert.equal(caught.field, testCase.expectedField, "case " + testCase.name + " field");
  }
});

test("authorization failure is returned as a typed UNAUTHORIZED result", async () => {
  const fixture = await loadJson("invalid-task-board-data.json");
  const executor = createTaskBoardExecutor();

  for (const testCase of fixture.authorizationCases) {
    const result = executor.createTaskFromEmail(testCase.input);
    assert.equal(result.ok, false, "case " + testCase.name);
    assert.equal(result.error.code, testCase.expectedErrorCode);
  }
});

test("local/demo mode bypasses authorization when no context is supplied", () => {
  const executor = createTaskBoardExecutor();
  const result = executor.createTaskFromEmail({
    email: {
      id: "e1",
      threadId: "t1",
      from: "a@b.test",
      to: [],
      subject: "s",
      receivedAt: "2026-06-15T09:15:00Z",
      body: "b",
    },
  });
  assert.equal(result.ok, true);
});

test("isAuthorized respects allowedRoles from context", () => {
  assert.equal(isAuthorized(undefined), true);
  assert.equal(isAuthorized({ requesterId: "u", role: "agent", allowedRoles: ["agent"] }), true);
  assert.equal(isAuthorized({ requesterId: "u", role: "viewer", allowedRoles: ["agent"] }), false);
});

test("unexpected internal failure is surfaced as INTERNAL_ERROR, not thrown", () => {
  const throwingExtract = () => {
    throw new Error("Simulated datastore outage");
  };
  const executor = createTaskBoardExecutor({ extract: throwingExtract });

  const result = executor.createTaskFromEmail({
    email: {
      id: "e1",
      threadId: "t1",
      from: "a@b.test",
      to: [],
      subject: "s",
      receivedAt: "2026-06-15T09:15:00Z",
      body: "b",
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "INTERNAL_ERROR");
});

test("extractTaskFromEmail matches the fixture contract output", async () => {
  const fixture = await loadJson("sample-task-emails-contract.json");
  for (let i = 0; i < fixture.emails.length; i++) {
    const card = extractTaskFromEmail(fixture.emails[i]);
    assert.deepEqual(card, fixture.expectedCards[i]);
  }
});
