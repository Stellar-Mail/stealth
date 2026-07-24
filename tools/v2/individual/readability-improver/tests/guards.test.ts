import { describe, expect, it } from "vitest";

import {
  GUARD_LIMITS,
  checkInputLimits,
  safeImproveReadability,
  sanitizeInput,
  sanitizeText,
  validateInput,
  validateOptions,
} from "../services/guards";
import { failureFixtures, successFixtures } from "../services/fixtures";
import type { ReadabilityInput } from "../types/readabilityImprover";

function makeInput(overrides: Partial<ReadabilityInput> = {}): ReadabilityInput {
  return {
    messageId: "msg-guard-001",
    subject: "Hello",
    body: "A short and simple note.",
    ...overrides,
  };
}

describe("sanitizeText", () => {
  it("strips control and zero-width characters", () => {
    expect(sanitizeText("he\u0000llo\u200b world\u2060")).toBe("hello world");
  });

  it("normalizes composed characters to NFC", () => {
    expect(sanitizeText("cafe\u0301")).toBe("café");
  });
});

describe("validateInput", () => {
  it("accepts a minimal valid input", () => {
    expect(validateInput(makeInput())).toBe(true);
  });

  it("rejects non-objects, null, and arrays", () => {
    expect(validateInput("text")).toBe(false);
    expect(validateInput(null)).toBe(false);
    expect(validateInput([makeInput()])).toBe(false);
  });

  it("rejects a missing or blank messageId", () => {
    expect(validateInput({ ...makeInput(), messageId: undefined })).toBe(false);
    expect(validateInput(makeInput({ messageId: "   " }))).toBe(false);
  });

  it("rejects non-string subject or body", () => {
    expect(validateInput({ ...makeInput(), subject: 5 })).toBe(false);
    expect(validateInput({ ...makeInput(), body: undefined })).toBe(false);
  });

  it("rejects an unparseable receivedAt", () => {
    expect(validateInput(makeInput({ receivedAt: "not-a-date" }))).toBe(false);
    expect(validateInput(makeInput({ receivedAt: "2026-07-01T00:00:00.000Z" }))).toBe(true);
  });
});

describe("validateOptions", () => {
  it("accepts undefined and valid shapes", () => {
    expect(validateOptions(undefined)).toBe(true);
    expect(validateOptions({})).toBe(true);
    expect(validateOptions({ includeIssues: false, maxIssues: 10 })).toBe(true);
  });

  it("rejects wrong types and out-of-range maxIssues", () => {
    expect(validateOptions({ includeIssues: "yes" })).toBe(false);
    expect(validateOptions({ maxIssues: 0 })).toBe(false);
    expect(validateOptions({ maxIssues: Number.NaN })).toBe(false);
    expect(validateOptions({ maxIssues: 101 })).toBe(false);
  });
});

describe("checkInputLimits", () => {
  it("returns no issues within limits", () => {
    expect(checkInputLimits(makeInput())).toEqual([]);
  });

  it("flags each oversized field with input-too-large", () => {
    const issues = checkInputLimits(
      makeInput({
        messageId: "x".repeat(GUARD_LIMITS.maxMessageIdChars + 1),
        subject: "y".repeat(GUARD_LIMITS.maxSubjectChars + 1),
        body: "z".repeat(GUARD_LIMITS.maxBodyChars + 1),
      }),
    );
    expect(issues).toHaveLength(3);
    expect(issues.every((issue) => issue.code === "input-too-large")).toBe(true);
    expect(issues.map((issue) => issue.field)).toEqual(["messageId", "subject", "body"]);
  });

  it("flags a body with too many words even under the char limit", () => {
    const issues = checkInputLimits(
      makeInput({
        body: Array(GUARD_LIMITS.maxBodyWords + 1)
          .fill("w")
          .join(" "),
      }),
    );
    expect(issues).toEqual([expect.objectContaining({ code: "input-too-large", field: "body" })]);
  });
});

describe("sanitizeInput", () => {
  it("returns a cleaned copy without mutating the original", () => {
    const input = makeInput({ messageId: "  msg-1  ", subject: "Hi\u200b", body: "ok" });
    const cleaned = sanitizeInput(input);
    expect(cleaned).toMatchObject({ messageId: "msg-1", subject: "Hi", body: "ok" });
    expect(input.messageId).toBe("  msg-1  ");
  });
});

describe("safeImproveReadability", () => {
  it("returns ok with the expected issue types for every success fixture", () => {
    for (const fixture of successFixtures) {
      const outcome = safeImproveReadability(fixture.input);
      expect(outcome.status, fixture.name).toBe("ok");
      if (outcome.status === "ok") {
        expect(
          outcome.result.issues.map((issue) => issue.type),
          fixture.name,
        ).toEqual(fixture.expectedIssueTypes);
      }
    }
  });

  it("returns the expected error code for every failure fixture", () => {
    for (const fixture of failureFixtures) {
      const outcome = safeImproveReadability(fixture.input);
      expect(outcome.status, fixture.name).toBe("error");
      if (outcome.status === "error") {
        expect(outcome.code, fixture.name).toBe(fixture.expectedCode);
        expect(outcome.issues.length, fixture.name).toBeGreaterThan(0);
      }
    }
  });

  it("rejects invalid options with invalid-options", () => {
    const outcome = safeImproveReadability(makeInput(), { maxIssues: -5 });
    expect(outcome).toMatchObject({ status: "error", code: "invalid-options" });
  });

  it("accepts regional English language tags", () => {
    const outcome = safeImproveReadability(makeInput({ language: "en-GB" }));
    expect(outcome.status).toBe("ok");
  });

  it("analyzes sanitized text so hidden characters cannot mask wordy terms", () => {
    const outcome = safeImproveReadability(
      makeInput({ subject: "", body: "We will uti\u200blize the tool." }),
    );
    expect(outcome.status).toBe("ok");
    if (outcome.status === "ok") {
      expect(outcome.result.issues.map((issue) => issue.type)).toEqual(["complex-word"]);
    }
  });

  it("never throws on hostile payloads", () => {
    const hostile = [null, 42, "text", [], { messageId: 1 }, { __proto__: { subject: "x" } }];
    for (const payload of hostile) {
      expect(() => safeImproveReadability(payload)).not.toThrow();
      expect(safeImproveReadability(payload).status).toBe("error");
    }
  });
});
