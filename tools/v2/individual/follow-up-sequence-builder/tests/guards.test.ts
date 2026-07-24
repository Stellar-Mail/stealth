import { describe, expect, it } from "vitest";

import {
  GUARD_LIMITS,
  checkInputLimits,
  checkOptionsLimits,
  safeBuildSequence,
  sanitizeInput,
  sanitizeText,
  validateInput,
  validateOptions,
} from "../services/guards";
import type { SequenceBuildInput } from "../services/followUpSequenceBuilder";

function validInput(overrides: Partial<SequenceBuildInput> = {}): SequenceBuildInput {
  return {
    messageId: "msg-guard-1",
    subject: "Follow up on contract",
    body: "Please get back to me by 2026-08-15.",
    senderAddress: "vendor@example.com",
    receivedAt: "2026-07-01T09:00:00.000Z",
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
  it("accepts a valid SequenceBuildInput", () => {
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
    expect(validateInput(rest as unknown as SequenceBuildInput)).toBe(false);
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
    expect(validateInput(rest as unknown as SequenceBuildInput)).toBe(false);
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
    const input: SequenceBuildInput = validInput({
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
    const options = validateOptions({ now: "2026-07-01T00:00:00.000Z" });
    expect(options.now).toBe("2026-07-01T00:00:00.000Z");
  });

  it("clamps maxSteps to the guard limit", () => {
    const options = validateOptions({ maxSteps: 100 });
    expect(options.maxSteps).toBe(GUARD_LIMITS.maxSteps);
  });

  it("extracts and filters existingSequences", () => {
    const options = validateOptions({
      existingSequences: [
        { sourceMessageId: "msg-1", title: "Seq 1" },
        { sourceMessageId: "msg-2", title: "Seq 2" },
      ],
    });
    expect(options.existingSequences).toHaveLength(2);
  });

  it("ignores malformed entries in existingSequences", () => {
    const options = validateOptions({
      existingSequences: [
        { sourceMessageId: "msg-1", title: "Seq 1" },
        { sourceMessageId: 42, title: "Seq 2" },
        null,
        { sourceMessageId: "msg-3", title: "Seq 3" },
      ],
    });
    expect(options.existingSequences).toHaveLength(2);
  });
});

describe("checkOptionsLimits", () => {
  it("returns null for options within limits", () => {
    expect(checkOptionsLimits({})).toBeNull();
    expect(
      checkOptionsLimits({
        existingSequences: [{ sourceMessageId: "a", title: "Seq" }],
      }),
    ).toBeNull();
  });

  it("rejects oversized existingSequences", () => {
    const manySequences = Array.from({ length: GUARD_LIMITS.maxExistingSequences + 1 }, (_, i) => ({
      sourceMessageId: "msg-" + i,
      title: "Seq " + i,
    }));
    const issue = checkOptionsLimits({ existingSequences: manySequences });
    expect(issue?.code).toBe("too-many-existing-sequences");
  });
});

describe("safeBuildSequence", () => {
  it("passes a valid input through to the engine and returns a sequence", () => {
    const result = safeBuildSequence(validInput());
    if (result.status !== "ok") return;
    expect(result.sequence.steps.length).toBeGreaterThan(0);
    expect(result.sequence.sourceMessageId).toBe("msg-guard-1");
  });

  it("rejects invalid input shape before the engine runs", () => {
    const result = safeBuildSequence({ subject: "Hi" });
    expect(result.status).toBe("error");
    if (result.status !== "error") return;
    expect(result.code).toBe("invalid-input");
  });

  it("rejects oversized input before the engine runs", () => {
    const result = safeBuildSequence(
      validInput({ body: "a".repeat(GUARD_LIMITS.maxBodyChars + 1) }),
    );
    expect(result.status).toBe("error");
    if (result.status !== "error") return;
    expect(result.code).toBe("input-too-large");
  });

  it("sanitizes hidden characters before passing to the engine", () => {
    const result = safeBuildSequence(
      validInput({
        subject: "Follow up\u0000",
        body: "Please get back by 2026-08-01\u200b.",
      }),
    );
    if (result.status !== "ok") return;
    expect(result.sequence.steps.length).toBeGreaterThan(0);
  });

  it("handles optional options parameter", () => {
    const result = safeBuildSequence(
      validInput({
        messageId: "msg-dup",
        body: "Please follow up on this soon.",
      }),
      {
        existingSequences: [{ sourceMessageId: "msg-dup", title: "Existing" }],
      },
    );
    if (result.status !== "ok") return;
    expect(result.sequence.warnings.some((w) => w.toLowerCase().includes("already exists"))).toBe(
      true,
    );
  });

  it("rejects null input", () => {
    const result = safeBuildSequence(null);
    expect(result.status).toBe("error");
  });

  it("is deterministic for the same input", () => {
    const input = validInput();
    const a = safeBuildSequence(input);
    const b = safeBuildSequence(input);
    expect(a).toEqual(b);
  });
});
