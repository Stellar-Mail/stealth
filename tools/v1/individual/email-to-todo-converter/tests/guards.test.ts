import { describe, expect, it } from "vitest";
import {
  safeBuildTaskDraft,
  sanitizeText,
  validateEmailInput,
  sanitizeEmailInput,
  checkInputLimits,
  GUARD_LIMITS,
} from "../services/guards";
import { buildTaskDraft, type NormalizedEmail } from "../services/emailToTodo";
import {
  emailFixtures,
  fixtureEmailList,
  buildExpectedDraft,
  type FixtureEntry,
} from "../services/fixtures";

function baseEmail(overrides: Partial<NormalizedEmail> = {}): NormalizedEmail {
  return {
    subject: "Project kickoff notes",
    sender: "alex@example.com",
    receivedAt: "2026-01-10T09:00:00.000Z",
    body: "Please review the attached plan.",
    ...overrides,
  };
}

describe("sanitizeText", () => {
  it("strips control characters", () => {
    expect(sanitizeText("hello\u0000world")).toBe("helloworld");
  });

  it("strips HTML-like tags", () => {
    expect(sanitizeText("<script>alert(1)</script> hello")).toBe(" alert(1)  hello");
  });

  it("strips invisible unicode characters", () => {
    expect(sanitizeText("foo\u200bbar")).toBe("foobar");
  });

  it("normalizes NFC", () => {
    const composed = "\u00C9";
    const decomposed = "\u0045\u0301";
    expect(sanitizeText(decomposed)).toBe(composed);
  });

  it("handles empty strings", () => {
    expect(sanitizeText("")).toBe("");
  });
});

describe("validateEmailInput", () => {
  it("rejects null", () => {
    expect(validateEmailInput(null)).toBe(false);
  });

  it("rejects non-objects", () => {
    expect(validateEmailInput("string")).toBe(false);
  });

  it("rejects missing fields", () => {
    expect(validateEmailInput({ subject: "hello" })).toBe(false);
  });

  it("accepts a valid email object", () => {
    expect(validateEmailInput(baseEmail())).toBe(true);
  });

  it("rejects non-string subject", () => {
    expect(validateEmailInput({ ...baseEmail(), subject: 42 })).toBe(false);
  });

  it("rejects non-string sender", () => {
    expect(validateEmailInput({ ...baseEmail(), sender: null })).toBe(false);
  });

  it("rejects non-string receivedAt", () => {
    expect(validateEmailInput({ ...baseEmail(), receivedAt: 123 })).toBe(false);
  });
});

describe("sanitizeEmailInput", () => {
  it("returns a new object without mutating the original", () => {
    const input = baseEmail();
    const sanitized = sanitizeEmailInput(input);
    expect(sanitized).not.toBe(input);
  });

  it("cleans text fields", () => {
    const input = baseEmail({ subject: "hello\u0000world", body: "<p>clean</p>" });
    const sanitized = sanitizeEmailInput(input);
    expect(sanitized.subject).toBe("helloworld");
    expect(sanitized.body).toBe(" clean ");
  });

  it("caps labels at the max limit", () => {
    const manyLabels = Array.from({ length: 30 }, (_, i) => `label-${i}`);
    const sanitized = sanitizeEmailInput(baseEmail({ labels: manyLabels }));
    expect(sanitized.labels).toHaveLength(GUARD_LIMITS.maxLabels);
  });

  it("filters empty labels", () => {
    const sanitized = sanitizeEmailInput(baseEmail({ labels: ["a", "", "  ", "b"] }));
    expect(sanitized.labels).toEqual(["a", "b"]);
  });
});

describe("checkInputLimits", () => {
  it("returns null for normal input", () => {
    expect(checkInputLimits(baseEmail())).toBeNull();
  });

  it("rejects oversized subject", () => {
    const longSubject = "x".repeat(GUARD_LIMITS.maxSubjectChars + 1);
    const issue = checkInputLimits(baseEmail({ subject: longSubject }));
    expect(issue).not.toBeNull();
    expect(issue?.code).toBe("input-too-large");
  });

  it("rejects oversized body", () => {
    const longBody = "x".repeat(GUARD_LIMITS.maxBodyChars + 1);
    const issue = checkInputLimits(baseEmail({ body: longBody }));
    expect(issue).not.toBeNull();
    expect(issue?.code).toBe("input-too-large");
  });

  it("rejects body with too many words", () => {
    const manyWords = Array.from({ length: GUARD_LIMITS.maxBodyWords + 100 }, () => "word").join(
      " ",
    );
    const issue = checkInputLimits(baseEmail({ body: manyWords }));
    expect(issue).not.toBeNull();
    expect(issue?.code).toBe("input-too-large");
  });

  it("rejects oversized sender", () => {
    const longSender = "a".repeat(GUARD_LIMITS.maxSenderChars + 1);
    const issue = checkInputLimits(baseEmail({ sender: longSender }));
    expect(issue).not.toBeNull();
    expect(issue?.code).toBe("input-too-large");
  });
});

describe("safeBuildTaskDraft", () => {
  it("rejects invalid input", () => {
    const result = safeBuildTaskDraft(null);
    expect(result.status).toBe("error");
    expect(result.code).toBe("invalid-input");
  });

  it("rejects missing required fields", () => {
    const result = safeBuildTaskDraft({ subject: "test" });
    expect(result.status).toBe("error");
    expect(result.code).toBe("invalid-input");
  });

  it("rejects non-convertible content", () => {
    const result = safeBuildTaskDraft({
      subject: "",
      sender: "x@y.com",
      receivedAt: "2026-01-01",
      body: "",
    });
    expect(result.status).toBe("error");
    expect(result.code).toBe("not-convertible");
  });

  it("rejects oversized input", () => {
    const result = safeBuildTaskDraft(
      baseEmail({ subject: "x".repeat(GUARD_LIMITS.maxSubjectChars + 1) }),
    );
    expect(result.status).toBe("error");
    expect(result.code).toBe("input-too-large");
  });

  it("successfully builds a draft for valid input", () => {
    const email = baseEmail();
    const result = safeBuildTaskDraft(email);
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.draft.title).toBe(email.subject);
      expect(result.warnings).toEqual([]);
    }
  });

  it("sanitizes input before processing", () => {
    const result = safeBuildTaskDraft(
      baseEmail({ subject: "hello\u0000world", body: "clean body text" }),
    );
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.draft.title).toBe("helloworld");
    }
  });

  it("is deterministic for the same input", () => {
    const email = baseEmail();
    const first = safeBuildTaskDraft(email);
    const second = safeBuildTaskDraft(email);
    expect(first).toEqual(second);
  });
});

describe("fixture smoke tests", () => {
  it("all fixtures produce expected titles", () => {
    for (const [key, entry] of Object.entries(emailFixtures)) {
      const draft = buildTaskDraft(entry.email);
      expect(draft.title).toBe(entry.expected.title);
    }
  });

  it("all fixtures produce expected priorities", () => {
    for (const [key, entry] of Object.entries(emailFixtures)) {
      const draft = buildTaskDraft(entry.email);
      expect(draft.suggestedPriority).toBe(entry.expected.priority);
    }
  });

  it("all fixtures produce expected due dates", () => {
    for (const [key, entry] of Object.entries(emailFixtures)) {
      const draft = buildTaskDraft(entry.email);
      expect(draft.suggestedDueDate).toBe(entry.expected.dueDate);
    }
  });

  it("all convertible fixtures pass through the safe entry point", () => {
    for (const [key, entry] of Object.entries(emailFixtures)) {
      if (key === "blankBodyAndSubject") {
        continue;
      }
      const result = safeBuildTaskDraft(entry.email);
      expect(result.status, `Fixture "${key}" failed: ${result.message}`).toBe("ok");
    }
  });

  it("rejects blank fixtures through the safe entry point", () => {
    const result = safeBuildTaskDraft(emailFixtures.blankBodyAndSubject.email);
    expect(result.status).toBe("error");
    expect(result.code).toBe("not-convertible");
  });

  it("fixtureEmailList contains all fixture emails", () => {
    expect(fixtureEmailList).toHaveLength(Object.keys(emailFixtures).length);
  });
});
