import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  REVIEW_FLAG_STATES,
  createReviewFlagReport,
  evaluateReviewItem,
} from "../index.mjs";

const sampleItems = JSON.parse(
  readFileSync(new URL("../fixtures/sample-review-items.json", import.meta.url), "utf-8"),
);

describe("Legal and Compliance Review Flag", () => {
  it("returns a loading state for pending callers", () => {
    const report = createReviewFlagReport({ isLoading: true });

    assert.equal(report.state, REVIEW_FLAG_STATES.LOADING);
    assert.equal(report.status, "pending");
    assert.deepEqual(report.items, []);
  });

  it("returns an empty state for a valid empty list", () => {
    const report = createReviewFlagReport({ items: [] });

    assert.equal(report.state, REVIEW_FLAG_STATES.EMPTY);
    assert.equal(report.status, "ready");
    assert.equal(report.summary.totalItems, 0);
  });

  it("returns an error state for invalid input", () => {
    const report = createReviewFlagReport({ items: [{ body: "No id or title" }] });

    assert.equal(report.state, REVIEW_FLAG_STATES.ERROR);
    assert.equal(report.status, "blocked");
    assert.ok(report.errors.some((message) => message.includes("id is required")));
  });

  it("flags legal, compliance, approval, and export concerns from fixtures", () => {
    const report = createReviewFlagReport({ items: sampleItems });

    assert.equal(report.state, REVIEW_FLAG_STATES.SUCCESS);
    assert.equal(report.status, "blocked");
    assert.equal(report.summary.totalItems, 4);
    assert.equal(report.summary.flaggedItems, 3);
    assert.equal(report.summary.clearItems, 1);
    assert.equal(report.summary.highestSeverity, "critical");

    const legalItem = report.items.find((item) => item.id === "mail-legal-001");
    assert.deepEqual(
      legalItem.flags.map((flag) => flag.code).sort(),
      ["compliance_risk", "legal_review_required", "missing_approval"].sort(),
    );
    assert.equal(legalItem.recommendedReviewer, "Legal and Compliance");

    const exportItem = report.items.find((item) => item.id === "mail-export-003");
    assert.equal(exportItem.severity, "critical");
    assert.ok(exportItem.flags.some((flag) => flag.code === "sanctions_export_review"));
  });

  it("marks routine messages as clear and low severity", () => {
    const routine = evaluateReviewItem(sampleItems.find((item) => item.id === "mail-clear-004"));

    assert.equal(routine.status, "clear");
    assert.equal(routine.severity, "low");
    assert.deepEqual(routine.flags, []);
    assert.equal(routine.recommendedReviewer, "Team Owner");
  });

  it("summarizes flag counts in deterministic severity order", () => {
    const report = createReviewFlagReport({ items: sampleItems });

    assert.deepEqual(
      report.flags.map((flag) => flag.code),
      [
        "missing_approval",
        "sanctions_export_review",
        "compliance_risk",
        "legal_review_required",
      ],
    );
  });
});
