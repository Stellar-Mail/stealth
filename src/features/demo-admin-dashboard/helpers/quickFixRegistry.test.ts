import { describe, expect, it } from "vitest";
import type { Draft } from "../types/draft";
import type { ValidationIssue } from "../validation-types";
import {
  SAFE_BODY,
  SAFE_RECIPIENT,
  SAFE_SUBJECT,
  applyQuickFix,
  createQuickFixRegistry,
  quickFixKindForIssue,
  toSafeRecipient,
} from "./quickFixRegistry";

function issue(overrides: Partial<ValidationIssue>): ValidationIssue {
  return {
    id: "draft-d1-subject-empty",
    severity: "error",
    fieldPath: "drafts[0].subject",
    message: "Subject is required for draft message.",
    datasetId: "campaign-drafts",
    recordId: "d1",
    ...overrides,
  };
}

const baseDraft: Draft = {
  id: "d1",
  subject: "",
  body: "",
  recipients: [],
};

describe("quickFixKindForIssue", () => {
  it("maps issue ids to fix kinds", () => {
    expect(quickFixKindForIssue(issue({ id: "draft-d1-subject-empty" }))).toBe("fill-subject");
    expect(quickFixKindForIssue(issue({ id: "draft-d1-body-empty" }))).toBe("fill-body");
    expect(quickFixKindForIssue(issue({ id: "draft-d1-recipients-empty" }))).toBe("add-recipient");
    expect(quickFixKindForIssue(issue({ id: "draft-d1-recipient-0-unsafe-domain" }))).toBe(
      "replace-unsafe-recipient",
    );
  });

  it("returns undefined for unknown issues", () => {
    expect(quickFixKindForIssue(issue({ id: "draft-d1-unknown" }))).toBeUndefined();
  });
});

describe("toSafeRecipient", () => {
  it("rewrites any address to a safe example.com address", () => {
    expect(toSafeRecipient("alice@evil.com")).toBe("alice@example.com");
    expect(toSafeRecipient("bob*federation")).toBe("bob@example.com");
    expect(toSafeRecipient("   ")).toBe("demo@example.com");
  });
});

describe("applyQuickFix", () => {
  const registry = createQuickFixRegistry();

  it("fills an empty subject without mutating the input", () => {
    const result = applyQuickFix([baseDraft], issue({ id: "draft-d1-subject-empty" }), registry);
    expect(result.applied).toBe(true);
    expect(result.drafts[0].subject).toBe(SAFE_SUBJECT);
    expect(baseDraft.subject).toBe("");
  });

  it("fills an empty body", () => {
    const result = applyQuickFix([baseDraft], issue({ id: "draft-d1-body-empty" }), registry);
    expect(result.drafts[0].body).toBe(SAFE_BODY);
  });

  it("adds a safe recipient when none exist", () => {
    const result = applyQuickFix(
      [baseDraft],
      issue({
        id: "draft-d1-recipients-empty",
        fieldPath: "drafts[0].recipients",
      }),
      registry,
    );
    expect(result.drafts[0].recipients).toEqual([SAFE_RECIPIENT]);
  });

  it("replaces an unsafe recipient by index", () => {
    const draft: Draft = {
      id: "d1",
      subject: "Hi",
      body: "Body",
      recipients: ["ok@example.com", "bad@evil.com"],
    };
    const result = applyQuickFix(
      [draft],
      issue({
        id: "draft-d1-recipient-1-unsafe-domain",
        fieldPath: "drafts[0].recipients[1]",
        severity: "warning",
      }),
      registry,
    );
    expect(result.drafts[0].recipients).toEqual(["ok@example.com", "bad@example.com"]);
  });

  it("does nothing when no fix matches", () => {
    const drafts = [baseDraft];
    const result = applyQuickFix(drafts, issue({ id: "draft-d1-unknown" }), registry);
    expect(result.applied).toBe(false);
    expect(result.drafts).toBe(drafts);
  });
});
