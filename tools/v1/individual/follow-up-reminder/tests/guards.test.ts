import { describe, expect, it } from "vitest";

import {
  GUARD_LIMITS,
  checkInputLimits,
  checkOptionsLimits,
  safeBuildFollowUpReminder,
  sanitizeInput,
  sanitizeText,
  validateInput,
  validateOptions,
} from "../services/guards";
import type { NormalizedEmailInput } from "../services/followUpReminder";

function validInput(overrides: Partial<NormalizedEmailInput> = {}): NormalizedEmailInput {
  return {
    messageId: "msg-guard-1",
    subject: "Follow up on contract",
    body: "Please reply by 2026-03-15 with the signed contract.",
    senderAddress: "vendor@example.com",
    receivedAt: "2026-03-01T09:00:00.000Z",
    ...overrides,
  };
}

describe("sanitizeText", () => {
  it("strips control characters but keeps tabs and newlines", () => {
    const dirty = "Hello\u0000 there\u0007\tworld\nline";
    expect(sanitizeText(dirty)).toBe("Hello there\tworld\nline");
  });

  it("removes zero-width and BOM characters", () => {
    const dirty = "in\u200bvis\u200dible\ufeff";
    expect(sanitizeText(dirty)).toBe("invisible");
  });

  it("normalizes unicode to NFC", () => {
    const decomposed = "e\u0301";
    expect(sanitizeText(decomposed)).toBe("\u00e9");
  });

  it("handles an already-clean string without changes", () => {
    expect(sanitizeText("Hello world")).toBe("Hello world");
  });
});

describe("validateInput", () => {
  it("accepts a valid NormalizedEmailInput", () => {
    expect(validateInput(validInput())).toBe(true);
  });

  it("accepts a valid input with optional fields", () => {
    expect(
      validateInput(
        validInput({
          senderName: "Vendor",
          timeZone: "America/New_York",
          threadHint: "Re: contract",
        }),
      ),
    ).toBe(true);
  });

  it("rejects null", () => {
    expect(validateInput(null)).toBe(false);
  });

  it("rejects a non-object value", () => {
    expect(validateInput("string")).toBe(false);
  });

  it("rejects when subject is missing", () => {
    const { subject: _, ...rest } = validInput();
    expect(validateInput(rest as unknown as NormalizedEmailInput)).toBe(false);
  });

  it("rejects when subject is not a string", () => {
    expect(validateInput(validInput({ subject: 42 as unknown as string }))).toBe(false);
  });

  it("rejects when body is not a string", () => {
    expect(validateInput(validInput({ body: null as unknown as string }))).toBe(false);
  });

  it("rejects when messageId is missing", () => {
    expect(validateInput(validInput({ messageId: "" }))).toBe(false);
  });

  it("rejects when senderAddress is missing", () => {
    const { senderAddress: _, ...rest } = validInput();
    expect(validateInput(rest as unknown as NormalizedEmailInput)).toBe(false);
  });

  it("rejects an invalid receivedAt date", () => {
    expect(validateInput(validInput({ receivedAt: "not-a-date" }))).toBe(false);
  });

  it("rejects a non-string senderName when present", () => {
    expect(validateInput(validInput({ senderName: 99 as unknown as string }))).toBe(false);
  });

  it("rejects a non-string threadHint when present", () => {
    expect(validateInput(validInput({ threadHint: true as unknown as string }))).toBe(false);
  });

  it("rejects a non-string timeZone when present", () => {
    expect(validateInput(validInput({ timeZone: [] as unknown as string }))).toBe(false);
  });
});

describe("checkInputLimits", () => {
  it("returns null for input within limits", () => {
    expect(checkInputLimits(validInput())).toBeNull();
  });

  it("rejects an oversized subject", () => {
    const issue = checkInputLimits(
      validInput({ subject: "x".repeat(GUARD_LIMITS.maxSubjectChars + 1) }),
    );
    expect(issue?.code).toBe("input-too-large");
  });

  it("rejects an oversized body by characters", () => {
    const issue = checkInputLimits(validInput({ body: "x".repeat(GUARD_LIMITS.maxBodyChars + 1) }));
    expect(issue?.code).toBe("input-too-large");
  });

  it("rejects an oversized body by word count", () => {
    const issue = checkInputLimits(
      validInput({ body: "word ".repeat(GUARD_LIMITS.maxBodyWords + 1) }),
    );
    expect(issue?.code).toBe("input-too-large");
  });
});

describe("sanitizeInput", () => {
  it("cleans text fields without mutating the input", () => {
    const input: NormalizedEmailInput = validInput({
      subject: "Hello\u0000",
      body: "Body\u200b",
      senderName: "Nam\u0000e",
      threadHint: "Re\u200b:",
    });
    const cleaned = sanitizeInput(input);
    expect(cleaned.subject).toBe("Hello");
    expect(cleaned.body).toBe("Body");
    expect(cleaned.senderName).toBe("Name");
    expect(cleaned.threadHint).toBe("Re:");
    expect(input.subject).toBe("Hello\u0000");
  });

  it("preserves non-text fields unchanged", () => {
    const input = validInput({ senderName: undefined, threadHint: undefined });
    const cleaned = sanitizeInput(input);
    expect(cleaned.messageId).toBe(input.messageId);
    expect(cleaned.senderAddress).toBe(input.senderAddress);
    expect(cleaned.receivedAt).toBe(input.receivedAt);
  });
});

describe("validateOptions", () => {
  it("returns an empty object for null or undefined", () => {
    expect(validateOptions(null)).toEqual({});
    expect(validateOptions(undefined)).toEqual({});
  });

  it("extracts a valid now string", () => {
    const options = validateOptions({ now: "2026-05-01T00:00:00.000Z" });
    expect(options.now).toBe("2026-05-01T00:00:00.000Z");
  });

  it("extracts and filters existingReminders", () => {
    const options = validateOptions({
      existingReminders: [
        { sourceMessageId: "msg-1", dueAt: "2026-05-10" },
        { sourceMessageId: "msg-2", dueAt: null },
      ],
    });
    expect(options.existingReminders).toHaveLength(2);
  });

  it("ignores malformed entries in existingReminders", () => {
    const options = validateOptions({
      existingReminders: [
        { sourceMessageId: "msg-1", dueAt: "2026-05-10" },
        { sourceMessageId: 42, dueAt: "2026-05-10" },
        null,
        { sourceMessageId: "msg-2", dueAt: "2026-06-01" },
      ],
    });
    expect(options.existingReminders).toHaveLength(2);
  });
});

describe("checkOptionsLimits", () => {
  it("returns null for options within limits", () => {
    expect(checkOptionsLimits({})).toBeNull();
    expect(
      checkOptionsLimits({ existingReminders: [{ sourceMessageId: "a", dueAt: "2026-01-01" }] }),
    ).toBeNull();
  });

  it("rejects oversized existingReminders", () => {
    const manyReminders = Array.from({ length: GUARD_LIMITS.maxExistingReminders + 1 }, (_, i) => ({
      sourceMessageId: "msg-" + i,
      dueAt: "2026-01-01",
    }));
    const issue = checkOptionsLimits({ existingReminders: manyReminders });
    expect(issue?.code).toBe("too-many-existing-reminders");
  });
});

describe("safeBuildFollowUpReminder", () => {
  it("passes a valid input through to the engine and returns a model", () => {
    const result = safeBuildFollowUpReminder(validInput());
    if (result.status !== "ok") return;
    expect(result.model.state).toBe("draft");
    expect(result.model.dueAt).toBe("2026-03-15");
  });

  it("rejects invalid input shape before the engine runs", () => {
    const result = safeBuildFollowUpReminder({ subject: "Hi" });
    expect(result.status).toBe("error");
    if (result.status !== "error") return;
    expect(result.code).toBe("invalid-input");
  });

  it("rejects oversized input before the engine runs", () => {
    const result = safeBuildFollowUpReminder(
      validInput({ body: "a".repeat(GUARD_LIMITS.maxBodyChars + 1) }),
    );
    expect(result.status).toBe("error");
    if (result.status !== "error") return;
    expect(result.code).toBe("input-too-large");
  });

  it("sanitizes hidden characters before passing to the engine", () => {
    const result = safeBuildFollowUpReminder(
      validInput({
        subject: "Reply here\u0000",
        body: "Follow up by 2026-04-01\u200b.",
      }),
    );
    if (result.status !== "ok") return;
    expect(result.model.state).toBe("draft");
    expect(result.model.dueAt).toBe("2026-04-01");
  });

  it("handles optional options parameter", () => {
    const result = safeBuildFollowUpReminder(
      validInput({
        messageId: "msg-dup",
        body: "Reply by 2026-04-10 about the contract.",
      }),
      {
        existingReminders: [{ sourceMessageId: "msg-dup", dueAt: "2026-04-10" }],
      },
    );
    if (result.status !== "ok") return;
    expect(result.model.state).toBe("no_action");
  });

  it("rejects null input", () => {
    const result = safeBuildFollowUpReminder(null);
    expect(result.status).toBe("error");
  });

  it("is deterministic for the same input", () => {
    const input = validInput();
    const a = safeBuildFollowUpReminder(input);
    const b = safeBuildFollowUpReminder(input);
    expect(a).toEqual(b);
  });
});
