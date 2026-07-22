import { describe, expect, it } from "vitest";

import { improveDraft, safeImproveDraft } from "../services/draftImprover";
import { failureFixtures, successFixtures } from "../services/fixtures";
import type { DraftImproverInput } from "../types/draftImprover";

function makeInput(overrides: Partial<DraftImproverInput> = {}): DraftImproverInput {
  return {
    messageId: "msg-draft-001",
    subject: "Quick update",
    body: "I am writing to let you know that the meeting has been moved to Friday.",
    ...overrides,
  };
}

describe("improveDraft", () => {
  it("returns a stable output for every success fixture", () => {
    for (const fixture of successFixtures) {
      const result = improveDraft(fixture.input);
      expect(result.messageId).toBe(fixture.input.messageId);
      expect(typeof result.improvedBody).toBe("string");
      expect(result.issues.map((issue) => issue.type)).toEqual(fixture.expectedIssueTypes);
      expect(result.score).toBeGreaterThanOrEqual(0);
    }
  });

  it("preserves a caller-supplied messageId and produces a shorter subject for empty input", () => {
    const result = improveDraft(makeInput({ subject: "", body: "Please review the attached files." }));
    expect(result.messageId).toBe("msg-draft-001");
    expect(result.improvedSubject.trim().length).toBeGreaterThan(0);
  });
});

describe("safeImproveDraft", () => {
  it("returns ok for each success fixture", () => {
    for (const fixture of successFixtures) {
      const outcome = safeImproveDraft(fixture.input);
      expect(outcome.status, fixture.name).toBe("ok");
      if (outcome.status === "ok") {
        expect(outcome.result.messageId).toBe(fixture.input.messageId);
      }
    }
  });

  it("returns error for each failure fixture", () => {
    for (const fixture of failureFixtures) {
      const outcome = safeImproveDraft(fixture.input);
      expect(outcome.status, fixture.name).toBe("error");
      if (outcome.status === "error") {
        expect(outcome.code).toBe(fixture.expectedCode);
        expect(outcome.issues.length).toBeGreaterThan(0);
      }
    }
  });
});
