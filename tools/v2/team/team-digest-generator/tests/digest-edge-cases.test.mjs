import test from "node:test";
import assert from "node:assert/strict";

import { generateTeamDigest } from "../src/digestGenerator.ts";

function item(overrides) {
  return {
    author: "Author",
    subject: "Subject",
    createdAt: "2026-06-01T09:00:00.000Z",
    ...overrides,
  };
}

test("topSubjects breaks ties alphabetically after ordering by count", () => {
  const items = [
    item({ id: "1", subject: "Zebra" }),
    item({ id: "2", subject: "Zebra" }),
    item({ id: "3", subject: "Mango" }),
    item({ id: "4", subject: "Apple" }),
  ];
  const summary = generateTeamDigest(items);
  assert.deepEqual(summary.topSubjects, ["Zebra", "Apple", "Mango"]);
});

test("topSubjectLimit of 0 yields no top subjects", () => {
  const summary = generateTeamDigest([item({ id: "1", subject: "Alpha" })], {
    topSubjectLimit: 0,
  });
  assert.deepEqual(summary.topSubjects, []);
});

test("topSubjects defaults to a maximum of 5 when no limit is given", () => {
  const items = ["A", "B", "C", "D", "E", "F"].map((subject, i) =>
    item({ id: String(i), subject }),
  );
  const summary = generateTeamDigest(items);
  assert.equal(summary.topSubjects.length, 5);
});

test("items without a project are excluded from the projects map", () => {
  const items = [item({ id: "1", project: "Roadmap" }), item({ id: "2" })];
  const summary = generateTeamDigest(items);
  assert.deepEqual(summary.projects, { Roadmap: 1 });
});

test("items without tags contribute nothing to the tags map", () => {
  const items = [item({ id: "1", tags: ["planning"] }), item({ id: "2" })];
  const summary = generateTeamDigest(items);
  assert.deepEqual(summary.tags, { planning: 1 });
});

test("isActionItem defaults to false when omitted", () => {
  const items = [
    item({ id: "1", isActionItem: true }),
    item({ id: "2" }),
    item({ id: "3", isActionItem: false }),
  ];
  const summary = generateTeamDigest(items);
  assert.equal(summary.actionItems.length, 1);
  assert.equal(summary.actionItems[0].id, "1");
});

test("generatedAt is a valid ISO-8601 timestamp", () => {
  const summary = generateTeamDigest([item({ id: "1" })]);
  assert.equal(new Date(summary.generatedAt).toISOString(), summary.generatedAt);
});
