import { describe, expect, it } from "vitest";
import type { Draft } from "./types/draft";
import type { ValidationIssue, ValidationSeverity } from "./validation-types";
import {
  SEVERITY_ORDER,
  getIssueNavigation,
  groupBySeverity,
  isDatasetValid,
  sortIssues,
  summarizeValidation,
  validateCampaignDrafts,
} from "./validation";

function vIssue(id: string, severity: ValidationSeverity, fieldPath: string): ValidationIssue {
  return {
    id,
    severity,
    fieldPath,
    message: "msg",
    datasetId: "campaign-drafts",
  };
}

const validDraft: Draft = {
  id: "d1",
  subject: "Quarterly demo update",
  body: "This is a safe demo body.",
  recipients: ["alice@example.com"],
};

describe("validateCampaignDrafts", () => {
  it("returns no issues for a valid draft", () => {
    expect(validateCampaignDrafts([validDraft])).toEqual([]);
  });

  it("reports an info issue when there are no drafts", () => {
    const issues = validateCampaignDrafts([]);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe("campaign-empty");
    expect(issues[0].severity).toBe("info");
  });

  it("flags an empty subject as an error", () => {
    const issues = validateCampaignDrafts([
      { id: "d2", subject: "   ", body: "Body", recipients: ["a@example.com"] },
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe("draft-d2-subject-empty");
    expect(issues[0].severity).toBe("error");
    expect(issues[0].fieldPath).toBe("drafts[0].subject");
  });

  it("flags an empty body and empty recipients as errors", () => {
    const issues = validateCampaignDrafts([{ id: "d3", subject: "Hi", body: "", recipients: [] }]);
    const ids = issues.map((issue) => issue.id);
    expect(ids).toContain("draft-d3-body-empty");
    expect(ids).toContain("draft-d3-recipients-empty");
  });

  it("flags a recipient with no @ or * as invalid format", () => {
    const issues = validateCampaignDrafts([
      { id: "d4", subject: "Hi", body: "Body", recipients: ["not-an-address"] },
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe("draft-d4-recipient-0-invalid-format");
    expect(issues[0].severity).toBe("error");
  });

  it("warns about a recipient on an unsafe domain", () => {
    const issues = validateCampaignDrafts([
      { id: "d5", subject: "Hi", body: "Body", recipients: ["bob@evil.com"] },
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe("draft-d5-recipient-0-unsafe-domain");
    expect(issues[0].severity).toBe("warning");
  });
});

describe("summarizeValidation", () => {
  it("counts issues per severity plus total", () => {
    const issues = [
      vIssue("a", "error", "x"),
      vIssue("b", "warning", "y"),
      vIssue("c", "info", "z"),
      vIssue("d", "error", "w"),
    ];
    expect(summarizeValidation(issues)).toEqual({
      error: 2,
      warning: 1,
      info: 1,
      total: 4,
    });
  });
});

describe("sortIssues", () => {
  it("orders by severity (errors first), then field path", () => {
    const issues = [
      vIssue("wb", "warning", "b"),
      vIssue("ez", "error", "z"),
      vIssue("ea", "error", "a"),
      vIssue("ia", "info", "a"),
    ];
    expect(sortIssues(issues).map((issue) => issue.id)).toEqual(["ea", "ez", "wb", "ia"]);
  });
});

describe("groupBySeverity", () => {
  it("groups in severity order and omits empty groups", () => {
    const issues = [vIssue("a", "info", "z"), vIssue("b", "error", "y"), vIssue("c", "error", "a")];
    const groups = groupBySeverity(issues);
    expect(groups).toHaveLength(2);
    expect(groups[0].severity).toBe("error");
    expect(groups[0].issues.map((issue) => issue.id)).toEqual(["c", "b"]);
    expect(groups[1].severity).toBe("info");
  });
});

describe("getIssueNavigation", () => {
  it("extracts navigation metadata", () => {
    const issue: ValidationIssue = {
      id: "x",
      severity: "error",
      fieldPath: "drafts[0].subject",
      message: "msg",
      datasetId: "campaign-drafts",
      recordId: "d1",
    };
    expect(getIssueNavigation(issue)).toEqual({
      datasetId: "campaign-drafts",
      recordId: "d1",
      fieldPath: "drafts[0].subject",
    });
  });
});

describe("isDatasetValid", () => {
  it("is valid only when there are no error-severity issues", () => {
    expect(isDatasetValid([vIssue("a", "warning", "x")])).toBe(true);
    expect(isDatasetValid([vIssue("b", "error", "y")])).toBe(false);
  });
});

describe("SEVERITY_ORDER", () => {
  it("lists severities with errors first", () => {
    expect(SEVERITY_ORDER).toEqual(["error", "warning", "info"]);
  });
});
