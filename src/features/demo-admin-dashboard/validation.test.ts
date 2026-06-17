import { describe, expect, it } from "vitest";

import {
  getIssueNavigation,
  groupBySeverity,
  isDatasetValid,
  sortIssues,
  summarizeValidation,
  validateCampaignDrafts,
} from "./validation";
import type { ValidationIssue } from "./validation-types";

const issues: ValidationIssue[] = [
  {
    id: "1",
    severity: "warning",
    fieldPath: "records[1].labels",
    message: "w1",
    datasetId: "d",
    recordId: "r1",
  },
  {
    id: "2",
    severity: "error",
    fieldPath: "records[0].email",
    message: "e1",
    datasetId: "d",
    recordId: "r0",
  },
  {
    id: "3",
    severity: "info",
    fieldPath: "meta.generatedAt",
    message: "i1",
    datasetId: "d",
  },
  {
    id: "4",
    severity: "error",
    fieldPath: "records[2].postageAmount",
    message: "e2",
    datasetId: "d",
    recordId: "r2",
  },
];

describe("summarizeValidation", () => {
  it("counts issues by severity", () => {
    const summary = summarizeValidation(issues);
    expect(summary.error).toBe(2);
    expect(summary.warning).toBe(1);
    expect(summary.info).toBe(1);
    expect(summary.total).toBe(4);
  });

  it("returns zeroes for an empty list", () => {
    expect(summarizeValidation([])).toEqual({
      error: 0,
      warning: 0,
      info: 0,
      total: 0,
    });
  });
});

describe("sortIssues", () => {
  it("orders errors first, then by field path", () => {
    expect(sortIssues(issues).map((issue) => issue.id)).toEqual(["2", "4", "1", "3"]);
  });

  it("does not mutate the input array", () => {
    const copy = [...issues];
    sortIssues(issues);
    expect(issues).toEqual(copy);
  });
});

describe("groupBySeverity", () => {
  it("groups in severity order and omits empty groups", () => {
    const groups = groupBySeverity(issues);
    expect(groups.map((group) => group.severity)).toEqual(["error", "warning", "info"]);
    expect(groups[0].issues).toHaveLength(2);
  });

  it("omits a severity with no issues", () => {
    const groups = groupBySeverity(issues.filter((issue) => issue.severity === "warning"));
    expect(groups).toHaveLength(1);
    expect(groups[0].severity).toBe("warning");
  });
});

describe("getIssueNavigation", () => {
  it("extracts dataset, record, and field path", () => {
    expect(getIssueNavigation(issues[1])).toEqual({
      datasetId: "d",
      recordId: "r0",
      fieldPath: "records[0].email",
    });
  });
});

describe("isDatasetValid", () => {
  it("is false when errors exist", () => {
    expect(isDatasetValid(issues)).toBe(false);
  });

  it("is true with only warnings and info", () => {
    expect(isDatasetValid(issues.filter((issue) => issue.severity !== "error"))).toBe(true);
  });
});

describe("validateCampaignDrafts", () => {
  it("returns an info issue if drafts list is empty", () => {
    const results = validateCampaignDrafts([]);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("info");
    expect(results[0].fieldPath).toBe("drafts");
    expect(results[0].message).toContain("no message drafts");
  });

  it("detects empty subject, empty body, and empty recipients", () => {
    const results = validateCampaignDrafts([
      {
        id: "draft-bad",
        subject: "",
        body: "   ",
        recipients: [],
      },
    ]);

    expect(results).toHaveLength(3);
    expect(results.filter((i) => i.severity === "error")).toHaveLength(3);
    expect(results[0].fieldPath).toBe("drafts[0].subject");
    expect(results[1].fieldPath).toBe("drafts[0].body");
    expect(results[2].fieldPath).toBe("drafts[0].recipients");
  });

  it("detects invalid recipient formatting (no @ and no *)", () => {
    const results = validateCampaignDrafts([
      {
        id: "draft-bad-recipient",
        subject: "Sub",
        body: "Body",
        recipients: ["invalidformat"],
      },
    ]);

    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("error");
    expect(results[0].fieldPath).toBe("drafts[0].recipients[0]");
    expect(results[0].message).toContain("format is invalid");
  });

  it("warns about unsafe/external domains", () => {
    const results = validateCampaignDrafts([
      {
        id: "draft-unsafe-recipient",
        subject: "Sub",
        body: "Body",
        recipients: ["user@untrusted.com", "user*untrusted.com"],
      },
    ]);

    expect(results).toHaveLength(2);
    expect(results.every((i) => i.severity === "warning")).toBe(true);
    expect(results[0].fieldPath).toBe("drafts[0].recipients[0]");
    expect(results[1].fieldPath).toBe("drafts[0].recipients[1]");
    expect(results[0].message).toContain("external or unverified domain");
  });

  it("passes with correct example domains and federation handles", () => {
    const results = validateCampaignDrafts([
      {
        id: "draft-good",
        subject: "Sub",
        body: "Body",
        recipients: ["alice@example.com", "bob@example.org", "new.user*stealth.demo"],
      },
    ]);

    expect(results).toHaveLength(0);
  });
});
