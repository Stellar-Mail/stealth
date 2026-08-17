import { describe, expect, it } from "vitest";

import {
  GUARD_LIMITS,
  checkRequestLimits,
  safeRewriteEmailTone,
  sanitizeRewriteRequest,
  sanitizeText,
} from "../services/guards";
import { type RewriteRequest } from "../services/emailToneRewriter";
import { FORMAL_FOLLOW_UP } from "../services/fixtures";

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
});

describe("checkRequestLimits", () => {
  const base: RewriteRequest = {
    subject: "Subject",
    bodyText: "A short body.",
    tone: "formal",
  };

  it("accepts a normal request", () => {
    expect(checkRequestLimits(base)).toBeNull();
  });

  it("rejects an oversized subject", () => {
    const issue = checkRequestLimits({
      ...base,
      subject: "x".repeat(GUARD_LIMITS.maxSubjectChars + 1),
    });
    expect(issue?.code).toBe("input-too-large");
  });

  it("rejects an oversized body by characters", () => {
    const issue = checkRequestLimits({
      ...base,
      bodyText: "x".repeat(GUARD_LIMITS.maxBodyChars + 1),
    });
    expect(issue?.code).toBe("input-too-large");
  });

  it("rejects an oversized body by word count", () => {
    const issue = checkRequestLimits({
      ...base,
      bodyText: "word ".repeat(GUARD_LIMITS.maxBodyWords + 1),
    });
    expect(issue?.code).toBe("input-too-large");
  });

  it("rejects non-positive or non-integer maxWords", () => {
    expect(checkRequestLimits({ ...base, maxWords: 0 })?.code).toBe("invalid-length-constraint");
    expect(checkRequestLimits({ ...base, maxWords: -5 })?.code).toBe("invalid-length-constraint");
    expect(checkRequestLimits({ ...base, maxWords: 3.5 })?.code).toBe("invalid-length-constraint");
  });

  it("rejects maxWords above the hard cap", () => {
    const issue = checkRequestLimits({
      ...base,
      maxWords: GUARD_LIMITS.maxLengthConstraint + 1,
    });
    expect(issue?.code).toBe("invalid-length-constraint");
  });
});

describe("sanitizeRewriteRequest", () => {
  it("cleans text fields without mutating the input", () => {
    const input: RewriteRequest = {
      subject: "Hi\u0000",
      bodyText: "Body\u200b",
      tone: "concise",
    };
    const cleaned = sanitizeRewriteRequest(input);
    expect(cleaned.subject).toBe("Hi");
    expect(cleaned.bodyText).toBe("Body");
    expect(input.subject).toBe("Hi\u0000");
  });
});

describe("safeRewriteEmailTone", () => {
  it("rejects oversized input before the engine runs", () => {
    const result = safeRewriteEmailTone({
      subject: "Big",
      bodyText: "word ".repeat(GUARD_LIMITS.maxBodyWords + 50),
      tone: "formal",
    });
    expect(result.status).toBe("error");
    if (result.status !== "error") return;
    expect(result.code).toBe("input-too-large");
  });

  it("rejects invalid length constraints", () => {
    const result = safeRewriteEmailTone({
      subject: "Hi",
      bodyText: "Please review.",
      tone: "formal",
      maxWords: 0,
    });
    expect(result.status).toBe("error");
    if (result.status !== "error") return;
    expect(result.code).toBe("invalid-length-constraint");
  });

  it("delegates malformed input to the engine", () => {
    const result = safeRewriteEmailTone({ subject: "x" });
    expect(result.status).toBe("error");
    if (result.status !== "error") return;
    expect(result.code).toBe("unsupported-input");
  });

  it("sanitizes and rewrites a valid draft", () => {
    const result = safeRewriteEmailTone({
      subject: "Follow up\u200b",
      bodyText: "Hey Sam, can you send the Q3 invoice by Friday?\u0000",
      tone: "formal",
    });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.rewrite.rewrittenBody).not.toContain("\u0000");
    expect(result.rewrite.preservedKeyPoints).toEqual(
      expect.arrayContaining(["Sam", "Q3", "Friday"]),
    );
  });

  it("is deterministic", () => {
    expect(safeRewriteEmailTone(FORMAL_FOLLOW_UP)).toEqual(safeRewriteEmailTone(FORMAL_FOLLOW_UP));
  });
});
