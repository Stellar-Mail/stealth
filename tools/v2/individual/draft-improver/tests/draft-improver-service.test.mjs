import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  analyzeDraft,
  createDraftImproverService,
  improveDraft,
  normalizeDraftInput,
  suggestSubjectLine,
  summarizeResults,
} from "../index.mjs";

const currentDir = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(currentDir, "..", "fixtures", "sample-drafts.json");

async function loadFixture() {
  const raw = await readFile(fixturePath, "utf8");
  return JSON.parse(raw);
}

test("normalizes draft input with safe defaults", () => {
  const draft = normalizeDraftInput({
    id: "  demo  ",
    body: "  Hello Pat, \n\n Please review this. \n\n Thanks, Alex  ",
    tone: "LOUD",
    channel: "unknown",
    audience: "peer",
  });

  assert.equal(draft.id, "demo");
  assert.equal(draft.tone, "neutral");
  assert.equal(draft.channel, "email");
  assert.equal(draft.audience, "peer");
  assert.equal(draft.body, "Hello Pat,\n\nPlease review this.\n\nThanks, Alex");
});

test("detects ready drafts without forcing review", () => {
  const result = improveDraft({
    id: "ready",
    subject: "Timeline",
    body: "Hi Maya,\n\nCould you review the updated project timeline and confirm Friday works?\n\nThanks,\nAlex",
  });

  assert.equal(result.status, "ready");
  assert.equal(result.reviewRequired, false);
  assert.equal(result.error, null);
  assert.ok(result.score >= 90);
});

test("returns blocked status for empty bodies", () => {
  const result = improveDraft({ id: "empty", body: "" });

  assert.equal(result.status, "blocked");
  assert.equal(result.reviewRequired, true);
  assert.ok(result.issues.some((issue) => issue.id === "missing-body"));
  assert.equal(result.output.body, "");
});

test("blocks likely sensitive data without dropping context", () => {
  const result = improveDraft({
    id: "sensitive",
    body: "Hi Sam,\n\nThe password is temporary-pass-123. Please use it today.\n\nThanks,\nAlex",
  });

  assert.equal(result.status, "blocked");
  assert.ok(result.issues.some((issue) => issue.id === "sensitive-data"));
  assert.equal(result.input.id, "sensitive");
});

test("softens harsh phrasing and repeated punctuation", () => {
  const result = improveDraft({
    id: "tone",
    body: "Per my last email, I need the launch notes ASAP!!",
    recipientName: "Jordan",
    senderName: "Alex",
    tone: "warm",
  });

  assert.equal(result.status, "needs-review");
  assert.match(result.output.body, /Hi Jordan,/);
  assert.match(result.output.body, /following up on my earlier note/);
  assert.match(result.output.body, /when you have a chance!/);
  assert.doesNotMatch(result.output.body, /ASAP|!!/);
  assert.ok(result.appliedChanges.includes("Add recipient greeting."));
});

test("adds a call-to-action suggestion when missing", () => {
  const result = improveDraft({
    id: "missing-action",
    body: "Hi Riley,\n\nThe report is attached.\n\nThanks,\nAlex",
  });

  assert.equal(result.status, "needs-review");
  assert.ok(result.issues.some((issue) => issue.id === "missing-action"));
  assert.match(result.output.body, /Please let me know what next step you recommend\./);
});

test("suggests a subject from the improved body", () => {
  const result = improveDraft({
    id: "subject",
    body: "Hi Priya,\n\nCould you review the launch checklist before Thursday?\n\nThanks,\nAlex",
  });

  assert.equal(result.output.subject, "Could you review the launch checklist before thursday");
  assert.equal(suggestSubjectLine(""), "Draft follow-up");
});

test("analyzes drafts without mutating the input object", () => {
  const input = {
    id: "immutable",
    body: "Need this fixed.",
    recipientName: "Riley",
  };
  const snapshot = JSON.stringify(input);
  const analysis = analyzeDraft(input);

  assert.equal(JSON.stringify(input), snapshot);
  assert.equal(analysis.id, "immutable");
  assert.equal(analysis.status, "needs-review");
});

test("service exposes loading and error state contract", () => {
  const service = createDraftImproverService();

  assert.deepEqual(service.getState(), {
    status: "idle",
    loading: false,
    error: null,
  });

  const invalid = service.improveDraft(null);

  assert.equal(invalid.status, "error");
  assert.equal(service.getState().status, "error");
  assert.equal(service.getState().loading, false);
  assert.equal(service.getState().error.code, "invalid-input");
});

test("batch review summarizes result statuses", async () => {
  const fixture = await loadFixture();
  const service = createDraftImproverService();
  const batch = service.improveMany(fixture.sourceDrafts);

  assert.equal(batch.loading, false);
  assert.equal(batch.error, null);
  assert.equal(batch.results.length, fixture.sourceDrafts.length);
  assert.deepEqual(batch.summary, summarizeResults(batch.results));
  assert.equal(batch.summary.totalDrafts, 4);
  assert.equal(batch.summary.ready, 1);
  assert.equal(batch.summary.needsReview, 2);
  assert.equal(batch.summary.blocked, 1);
});

test("batch review preserves invalid draft errors", () => {
  const service = createDraftImproverService();
  const batch = service.improveMany([null]);

  assert.equal(batch.results.length, 1);
  assert.equal(batch.results[0].status, "error");
  assert.equal(batch.summary.errors, 1);
});

test("sample fixture follows the local draft-improver contract", async () => {
  const fixture = await loadFixture();
  assert.equal(fixture.tool, "draft-improver");
  assert.ok(Array.isArray(fixture.sourceDrafts));
  assert.ok(Array.isArray(fixture.expected));
  assert.equal(fixture.sourceDrafts.length, fixture.expected.length);

  const results = fixture.sourceDrafts.map((draft) => improveDraft(draft));

  for (const expected of fixture.expected) {
    const result = results.find((item) => item.id === expected.id);
    assert.ok(result, `${expected.id} result is missing`);
    assert.equal(result.status, expected.status, `${expected.id} status mismatch`);
    assert.equal(
      result.reviewRequired,
      expected.reviewRequired,
      `${expected.id} reviewRequired mismatch`,
    );

    if (expected.minimumScore) {
      assert.ok(result.score >= expected.minimumScore, `${expected.id} score is too low`);
    }

    for (const issueId of expected.requiredIssues ?? []) {
      assert.ok(
        result.issues.some((issue) => issue.id === issueId),
        `${expected.id} missing issue ${issueId}`,
      );
    }

    for (const change of expected.requiredChanges ?? []) {
      assert.ok(
        result.appliedChanges.includes(change),
        `${expected.id} missing change ${change}`,
      );
    }
  }
});
