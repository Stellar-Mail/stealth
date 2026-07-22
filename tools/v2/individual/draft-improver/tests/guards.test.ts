import { describe, expect, it } from "vitest";

import {
  GUARD_LIMITS,
  checkInputLimits,
  sanitizeInput,
  sanitizeText,
  validateInput,
  validateOptions,
} from "../services/guards";
import type { DraftImproverInput } from "../types/draftImprover";

function makeInput(overrides: Partial<DraftImproverInput> = {}): DraftImproverInput {
  return {
    messageId: "msg-guard-001",
    subject: "Hello",
    body: "A short note with enough context.",
    ...overrides,
  };
}

describe("sanitizeText", () => {
  it("strips control characters and zero-width content", () => {
    expect(sanitizeText("Hello\u0000 world\u200b")).toBe("Hello world");
  });
});

describe("validateInput", () => {
  it("accepts a minimal valid contract", () => {
    expect(validateInput(makeInput())).toBe(true);
  });

  it("rejects malformed payloads", () => {
    expect(validateInput({ messageId: "", subject: "Hello", body: "Body" })).toBe(false);
    expect(validateInput({ messageId: "x", subject: 5, body: "Body" })).toBe(false);
  });
});

describe("validateOptions", () => {
  it("accepts a valid options shape", () => {
    expect(validateOptions(undefined)).toBe(true);
    expect(validateOptions({ includeSuggestions: false, maxSuggestions: 3 })).toBe(true);
  });

  it("rejects out-of-range values", () => {
    expect(validateOptions({ maxSuggestions: 0 })).toBe(false);
    expect(validateOptions({ maxSuggestions: 101 })).toBe(false);
  });
});

describe("checkInputLimits", () => {
  it("flags oversized fields", () => {
    const issues = checkInputLimits(
      makeInput({
        messageId: "x".repeat(GUARD_LIMITS.maxMessageIdChars + 1),
        subject: "y".repeat(GUARD_LIMITS.maxSubjectChars + 1),
        body: "z".repeat(GUARD_LIMITS.maxBodyChars + 1),
      }),
    );
    expect(issues.map((issue) => issue.field)).toEqual(["messageId", "subject", "body"]);
  });
});

describe("sanitizeInput", () => {
  it("returns a sanitized copy without mutating the source", () => {
    const input = makeInput({ subject: " Hi\u200b ", body: "ok" });
    const cleaned = sanitizeInput(input);
    expect(cleaned.subject).toBe("Hi");
    expect(input.subject).toBe(" Hi\u200b ");
  });
});
