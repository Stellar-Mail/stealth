import { describe, expect, it } from "vitest";

import {
  GUARD_LIMITS,
  checkInputLimits,
  safeExtractTasks,
  sanitizeInput,
  sanitizeText,
  validateInput,
  validateOptions,
} from "../services/guards";
import { failureFixtures, successFixtures } from "../services/fixtures";
import type { TaskExtractionInput } from "../types/taskExtractor";

function makeInput(overrides: Partial<TaskExtractionInput> = {}): TaskExtractionInput {
  return {
    messageId: "msg-guard-001",
    subject: "Hello",
    body: "Please review the update.",
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
    expect(validateOptions({ maxTasks: 5, minConfidence: "medium" })).toBe(true);
  });

  it("rejects wrong types and out-of-range values", () => {
    expect(validateOptions({ maxTasks: 0 })).toBe(false);
    expect(validateOptions({ maxTasks: Number.NaN })).toBe(false);
    expect(validateOptions({ maxTasks: 51 })).toBe(false);
    expect(validateOptions({ minConfidence: "urgent" })).toBe(false);
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

describe("safeExtractTasks", () => {
  it("returns ok with the expected tasks for every success fixture", () => {
    for (const fixture of successFixtures) {
      const outcome = safeExtractTasks(fixture.input);
      expect(outcome.status, fixture.name).toBe("ok");
      if (outcome.status === "ok") {
        expect(
          outcome.result.tasks.map((task) => task.text),
          fixture.name,
        ).toEqual(fixture.expectedTaskTexts);
      }
    }
  });

  it("returns the expected error code for every failure fixture", () => {
    for (const fixture of failureFixtures) {
      const outcome = safeExtractTasks(fixture.input);
      expect(outcome.status, fixture.name).toBe("error");
      if (outcome.status === "error") {
        expect(outcome.code, fixture.name).toBe(fixture.expectedCode);
        expect(outcome.issues.length, fixture.name).toBeGreaterThan(0);
      }
    }
  });

  it("rejects invalid options with invalid-options", () => {
    const outcome = safeExtractTasks(makeInput(), { maxTasks: -5 });
    expect(outcome).toMatchObject({ status: "error", code: "invalid-options" });
  });

  it("accepts regional English language tags", () => {
    const outcome = safeExtractTasks(makeInput({ language: "en-GB" }));
    expect(outcome.status).toBe("ok");
  });

  it("extracts from sanitized text so hidden characters cannot mask requests", () => {
    const outcome = safeExtractTasks(
      makeInput({ subject: "", body: "Plea\u200bse review the security report" }),
    );
    expect(outcome.status).toBe("ok");
    if (outcome.status === "ok") {
      expect(outcome.result.tasks.map((task) => task.text)).toEqual(["review the security report"]);
    }
  });

  it("never throws on hostile payloads", () => {
    const hostile = [null, 42, "text", [], { messageId: 1 }, { __proto__: { subject: "x" } }];
    for (const payload of hostile) {
      expect(() => safeExtractTasks(payload)).not.toThrow();
      expect(safeExtractTasks(payload).status).toBe("error");
    }
  });
});
