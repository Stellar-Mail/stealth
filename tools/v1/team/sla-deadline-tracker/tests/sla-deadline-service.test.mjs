import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  DEADLINE_STATES,
  SlaDeadlineValidationError,
  buildDeadlineQueue,
  evaluateDeadlineState,
  filterDeadlineQueue,
  normalizeDeadlineRecord,
  normalizeSlaPolicy,
  summarizeDeadlineQueue,
} from "../index.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(__dirname, "../fixtures/sample-sla-deadlines.json");
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));

test("normalizes SLA policy defaults", () => {
  assert.deepEqual(normalizeSlaPolicy({ name: " Support ", targetMinutes: 60 }), {
    name: "Support",
    targetMinutes: 60,
    dueSoonWindowMinutes: 30,
  });
});

test("rejects malformed SLA policies", () => {
  assert.throws(
    () => normalizeSlaPolicy({ name: "Broken", targetMinutes: 0 }),
    SlaDeadlineValidationError,
  );
});

test("normalizes deadline records and computes dueAt", () => {
  const normalized = normalizeDeadlineRecord(fixture.records[0]);

  assert.equal(normalized.id, "deadline-ok-001");
  assert.equal(normalized.dueAt, "2026-06-23T11:30:00.000Z");
  assert.equal(normalized.resolvedAt, null);
});

test("evaluates ok deadline state", () => {
  const result = evaluateDeadlineState(fixture.records[0], { now: fixture.now });

  assert.equal(result.state, DEADLINE_STATES.OK);
  assert.equal(result.minutesUntilDue, 90);
  assert.equal(result.isActionable, false);
});

test("evaluates due-soon deadline state", () => {
  const result = evaluateDeadlineState(fixture.records[1], { now: fixture.now });

  assert.equal(result.state, DEADLINE_STATES.DUE_SOON);
  assert.equal(result.minutesUntilDue, 20);
  assert.equal(result.isActionable, true);
});

test("evaluates breached deadline state", () => {
  const result = evaluateDeadlineState(fixture.records[2], { now: fixture.now });

  assert.equal(result.state, DEADLINE_STATES.BREACHED);
  assert.equal(result.minutesUntilDue, -150);
  assert.equal(result.isActionable, true);
});

test("evaluates resolved deadline state without actionable work", () => {
  const result = evaluateDeadlineState(fixture.records[3], { now: fixture.now });

  assert.equal(result.state, DEADLINE_STATES.RESOLVED);
  assert.equal(result.minutesUntilDue, null);
  assert.equal(result.isActionable, false);
});

test("builds queue sorted by due date with resolved records last", () => {
  const queue = buildDeadlineQueue(fixture.records, { now: fixture.now });

  assert.deepEqual(
    queue.map((item) => item.id),
    ["deadline-breached-003", "deadline-due-soon-002", "deadline-ok-001", "deadline-resolved-004"],
  );
});

test("filters deadline queue by state and assignee", () => {
  const queue = buildDeadlineQueue(fixture.records, { now: fixture.now });

  assert.deepEqual(
    filterDeadlineQueue(queue, { state: DEADLINE_STATES.BREACHED }).map((item) => item.id),
    ["deadline-breached-003"],
  );
  assert.deepEqual(
    filterDeadlineQueue(queue, { assignee: "riley@team.test" }).map((item) => item.id),
    ["deadline-due-soon-002"],
  );
});

test("summarizes deadline queue state counts", () => {
  const queue = buildDeadlineQueue(fixture.records, { now: fixture.now });

  assert.deepEqual(summarizeDeadlineQueue(queue), {
    total: 4,
    ok: 1,
    dueSoon: 1,
    breached: 1,
    resolved: 1,
    actionable: 2,
  });
});

test("rejects oversized batches before doing queue work", () => {
  assert.throws(
    () => buildDeadlineQueue(fixture.records, { now: fixture.now, maxRecords: 2 }),
    SlaDeadlineValidationError,
  );
});

test("fixture remains synthetic and free of sensitive fields", async () => {
  const fixtureText = await readFile(fixturePath, "utf8");

  assert.equal(fixture.records.every((record) => record.sharedInboxId.endsWith(".test")), true);
  assert.doesNotMatch(fixtureText, /password|secret|token|bank|card|wallet|seed/i);
});
