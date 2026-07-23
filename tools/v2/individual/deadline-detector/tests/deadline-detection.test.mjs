import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { detectDeadlines, sortDetectedDeadlines } from "../services/deadline-detector.service.ts";

const fixtureUrl = new URL("../fixtures/sample-deadline-messages.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const options = {
  now: fixture.runContext.now,
  defaultTimezone: fixture.runContext.timezone,
};
const result = detectDeadlines(fixture.sourceMessages, options);
const byId = new Map(result.deadlines.map((deadline) => [deadline.id, deadline]));

test("detectDeadlines returns one deadline per source message", () => {
  assert.equal(result.deadlines.length, fixture.sourceMessages.length);
  assert.equal(result.summary.totalMessages, fixture.sourceMessages.length);
  assert.equal(result.summary.totalDeadlines, fixture.sourceMessages.length);
});

for (const expected of fixture.expectedDeadlines) {
  test("detectDeadlines reproduces the expected result for " + expected.id, () => {
    const actual = byId.get(expected.id);
    assert.ok(actual, "no deadline produced for " + expected.id);
    assert.equal(actual.sourceMessageId, expected.sourceMessageId);
    assert.equal(actual.title, expected.title);
    assert.equal(actual.dueDate, expected.dueDate);
    assert.equal(actual.dueTime, expected.dueTime);
    assert.equal(actual.timezone, expected.timezone);
    assert.equal(actual.status, expected.status);
    assert.equal(actual.urgency, expected.urgency);
    assert.equal(actual.confidence, expected.confidence);
    assert.equal(actual.reviewRequired, expected.reviewRequired);
  });
}

test("summary status counts add up to the total", () => {
  const s = result.summary;
  assert.equal(s.detected + s.needsReview + s.missed + s.ignored, s.totalDeadlines);
});

test("sortDetectedDeadlines orders by urgency without mutating its input", () => {
  const original = [...result.deadlines];
  const sorted = sortDetectedDeadlines(result.deadlines);
  assert.deepEqual(result.deadlines, original);
  const rank = { overdue: 0, today: 1, soon: 2, later: 3, unknown: 4 };
  for (let i = 1; i < sorted.length; i += 1) {
    assert.ok(rank[sorted[i - 1].urgency] <= rank[sorted[i].urgency]);
  }
});
