import { describe, expect, it } from "vitest";

import {
  buildPublishChecklist,
  isReadyToPublish,
  SAFE_RECIPIENT_DOMAIN_PATTERN,
  sortPublishChecklistItems,
  summarizePublishChecklist,
} from "./publishChecklist";
import {
  demoPublishChecklistBlocked,
  demoPublishChecklistReady,
  demoPublishChecklistWithValidationErrors,
  publishBlockedDraftsNoRecipients,
  publishBlockedDraftsUnsafeDomain,
  publishReadyDrafts,
} from "./publishChecklistFixtures";
import { draftSample } from "./fixtures/draftFixtures";
import { demoValidationIssues, demoValidationIssuesEmpty } from "./validationFixtures";

describe("SAFE_RECIPIENT_DOMAIN_PATTERN", () => {
  it("accepts example.com and example.org addresses", () => {
    expect("alice@example.com").toMatch(SAFE_RECIPIENT_DOMAIN_PATTERN);
    expect("bob@example.org").toMatch(SAFE_RECIPIENT_DOMAIN_PATTERN);
  });

  it("accepts stealth.demo handles", () => {
    expect("demo@team.stealth.demo").toMatch(SAFE_RECIPIENT_DOMAIN_PATTERN);
  });

  it("rejects real-looking domains", () => {
    expect("user@gmail.com").not.toMatch(SAFE_RECIPIENT_DOMAIN_PATTERN);
  });
});

describe("publishChecklist module", () => {
  describe("buildPublishChecklist", () => {
    it("returns all passes for a valid draft dataset", () => {
      const result = buildPublishChecklist(publishReadyDrafts, demoValidationIssuesEmpty);
      expect(result.readyToPublish).toBe(true);
      expect(result.items.every((item) => item.status !== "blocked")).toBe(true);
    });

    it("blocks when the draft dataset is empty", () => {
      const result = buildPublishChecklist([], demoValidationIssuesEmpty);
      expect(result.readyToPublish).toBe(false);
      expect(result.items.find((item) => item.id === "drafts-present")?.status).toBe("blocked");
    });

    it("blocks when drafts have no recipients", () => {
      const result = buildPublishChecklist(
        publishBlockedDraftsNoRecipients,
        demoValidationIssuesEmpty,
      );
      expect(result.readyToPublish).toBe(false);
      expect(result.items.find((item) => item.id === "recipients-present")?.status).toBe("blocked");
    });

    it("blocks when recipients use unsafe domains", () => {
      const result = buildPublishChecklist(
        publishBlockedDraftsUnsafeDomain,
        demoValidationIssuesEmpty,
      );
      expect(result.readyToPublish).toBe(false);
      expect(result.items.find((item) => item.id === "safe-domains")?.status).toBe("blocked");
    });

    it("blocks when validation errors exist", () => {
      const result = buildPublishChecklist(publishReadyDrafts, demoValidationIssues);
      expect(result.readyToPublish).toBe(false);
      expect(result.items.find((item) => item.id === "validation-errors")?.status).toBe("blocked");
    });

    it("warns but does not block on validation warnings only", () => {
      const warningsOnly = demoValidationIssues.filter((issue) => issue.severity !== "error");
      const result = buildPublishChecklist(publishReadyDrafts, warningsOnly);
      expect(result.readyToPublish).toBe(true);
      expect(result.items.find((item) => item.id === "validation-warnings")?.status).toBe(
        "warning",
      );
    });

    it("blocks incomplete drafts missing required fields", () => {
      const incomplete = [{ ...draftSample, subject: "" }];
      const result = buildPublishChecklist(incomplete, demoValidationIssuesEmpty);
      expect(result.items.find((item) => item.id === "draft-fields")?.status).toBe("blocked");
    });
  });

  describe("summarizePublishChecklist", () => {
    it("counts items by status for validation-error fixture", () => {
      const summary = summarizePublishChecklist(demoPublishChecklistWithValidationErrors.items);
      expect(summary.blocked).toBeGreaterThan(0);
      expect(summary.total).toBe(demoPublishChecklistWithValidationErrors.items.length);
    });

    it("reports no blockers for ready fixture", () => {
      expect(summarizePublishChecklist(demoPublishChecklistReady.items).blocked).toBe(0);
    });

    it("reports blockers for blocked fixture", () => {
      expect(summarizePublishChecklist(demoPublishChecklistBlocked.items).blocked).toBeGreaterThan(
        0,
      );
    });
  });

  describe("sortPublishChecklistItems", () => {
    it("orders blocked before warnings before passes", () => {
      const sorted = sortPublishChecklistItems(demoPublishChecklistWithValidationErrors.items);
      const statuses = sorted.map((item) => item.status);
      expect(statuses.indexOf("blocked")).toBeLessThan(statuses.indexOf("warning"));
      expect(statuses.indexOf("warning")).toBeLessThan(statuses.indexOf("pass"));
    });
  });

  describe("isReadyToPublish", () => {
    it("is false when any item is blocked", () => {
      expect(isReadyToPublish(demoPublishChecklistBlocked.items)).toBe(false);
    });

    it("is true for the ready fixture", () => {
      expect(isReadyToPublish(demoPublishChecklistReady.items)).toBe(true);
    });
  });
});
