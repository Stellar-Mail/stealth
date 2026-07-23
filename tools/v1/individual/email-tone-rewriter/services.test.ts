import { describe, expect, it } from "vitest";

import {
  SUPPORTED_TONES as SUPPORTED_TONES_NEW,
  rewriteEmailTone as rewriteEmailToneNew,
  extractKeyPoints,
  toReadyState,
  type RewriteRequest,
} from "./services/emailToneRewriter";
import {
  sanitizeText,
  sanitizeRewriteRequest,
  checkRequestLimits,
  GUARD_LIMITS,
  safeRewriteEmailTone,
} from "./services/guards";
import {
  FORMAL_FOLLOW_UP,
  FRIENDLY_DELAY,
  UNSUPPORTED_TONE_DRAFT,
  EMPTY_BODY_DRAFT,
  SAMPLE_DRAFTS,
} from "./services/fixtures";
import { rewriteEmailTone as rewriteEmailToneOld } from "./services";
import { validateRewriteInput, extractPreservedKeyPoints } from "./services";

describe("Email Tone Rewriter core service (legacy API compatibility)", () => {
  it("supports the documented V1 tones through the legacy API", () => {
    expect(SUPPORTED_TONES_NEW).toEqual(["concise", "friendly", "formal", "apologetic"]);
  });

  it("rewrites a draft into a selected tone without enabling send or save actions", () => {
    const result = rewriteEmailToneOld({
      subject: "Follow up",
      bodyText:
        "Hi Maya, please review the invoice for $240 by June 22. I need approval before the 6/24 client call.",
      tone: "formal",
    });

    expect(result.status).toBe("success");
    expect(result.rewrittenBody).toContain("Hello,");
    expect(result.rewrittenBody).toContain("Maya");
    expect(result.rewrittenBody).toContain("$240");
    expect(result.rewrittenBody).toContain("June 22");
    expect(result.rewrittenBody).toContain("6/24");
    expect(result.sendDisabled).toBe(true);
    expect(result.saveDisabled).toBe(true);
  });

  it("preserves key names, dates, amounts, and request sentences for review", () => {
    const keyPoints = extractPreservedKeyPoints(
      "Alex, please confirm the $99 refund by 12/15. Reference https://example.test/refund for the ticket.",
    );

    expect(keyPoints).toContain("Alex");
    expect(keyPoints).toContain("$99");
    expect(keyPoints).toContain("12/15");
    expect(keyPoints).toContain("https://example.test/refund");
    expect(keyPoints.some((point) => point.includes("please confirm"))).toBe(true);
  });

  it("returns deterministic validation errors for empty drafts and unsupported tones", () => {
    expect(validateRewriteInput({ bodyText: "", tone: "friendly" })).toContain(
      "Draft body is required.",
    );
    expect(validateRewriteInput({ bodyText: "hello", tone: "angry" as never })).toContain(
      "Tone must be one of: concise, friendly, formal, apologetic.",
    );
  });

  it("applies maxSentences without dropping the extracted preserved key points", () => {
    const result = rewriteEmailToneOld({
      subject: "Launch note",
      bodyText:
        "Priya, please send the launch note today. The preview link is https://example.test/launch. The budget is $500. Reply after review.",
      tone: "concise",
      maxSentences: 1,
    });

    expect(result.status).toBe("success");
    expect(result.rewrittenBody).not.toContain("The budget is $500");
    expect(result.preservedKeyPoints).toContain("Priya");
    expect(result.preservedKeyPoints).toContain("https://example.test/launch");
    expect(result.preservedKeyPoints).toContain("$500");
  });
});

describe("Email Tone Rewriter core service (robust new engine)", () => {
  it("rewrites a follow-up into formal tone and preserves facts", () => {
    const result = rewriteEmailToneNew(FORMAL_FOLLOW_UP);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.rewrite.tone).toBe("formal");
    expect(result.rewrite.preservedKeyPoints).toEqual(
      expect.arrayContaining(["Sam", "Q3", "Friday"]),
    );
    expect(result.rewrite.rewrittenBody).toContain("Sam");
    expect(result.rewrite.rewrittenBody).toContain("Q3");
    expect(result.rewrite.rewrittenBody).toContain("Friday");
    expect(result.rewrite.rewrittenBody).not.toContain("Hey");
    expect(result.rewrite.changed).toBe(true);
  });

  it("softens a blunt note for the friendly tone without inventing a reason", () => {
    const result = rewriteEmailToneNew(FRIENDLY_DELAY);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.rewrite.rewrittenBody).toContain("tomorrow");
    expect(result.rewrite.rewrittenBody.toLowerCase()).not.toContain("because");
    expect(result.rewrite.preservedKeyPoints).toContain("tomorrow morning");
  });

  it("preserves dates, names, amounts, and links", () => {
    const request: RewriteRequest = {
      subject: "Payment",
      bodyText:
        "Hey Dana, please pay the $250 invoice by Monday and see https://pay.example.com for details.",
      tone: "formal",
    };
    const result = rewriteEmailToneNew(request);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    const body = result.rewrite.rewrittenBody;
    expect(body).toContain("Dana");
    expect(body).toContain("$250");
    expect(body).toContain("Monday");
    expect(body).toContain("https://pay.example.com");
    expect(result.rewrite.preservedKeyPoints).toEqual(
      expect.arrayContaining(["Dana", "$250", "Monday", "https://pay.example.com"]),
    );
  });

  it("returns a deterministic error for an unsupported tone", () => {
    const draft = UNSUPPORTED_TONE_DRAFT as unknown as RewriteRequest;
    const result = rewriteEmailToneNew(draft);

    expect(result.status).toBe("error");
    if (result.status !== "error") return;
    expect(result.code).toBe("unsupported-tone");
    expect(rewriteEmailToneNew(draft)).toEqual(result);
  });

  it("rejects an empty draft body", () => {
    const result = rewriteEmailToneNew(EMPTY_BODY_DRAFT);

    expect(result.status).toBe("error");
    if (result.status !== "error") return;
    expect(result.code).toBe("empty-body");
  });

  it("rejects malformed input", () => {
    const result = rewriteEmailToneNew({
      subject: "x",
    } as unknown as RewriteRequest);

    expect(result.status).toBe("error");
    if (result.status !== "error") return;
    expect(result.code).toBe("unsupported-input");
  });

  it("applies length constraints without dropping required facts", () => {
    const request: RewriteRequest = {
      subject: "Reminder",
      bodyText:
        "Send the Q3 invoice by Friday. This is a friendly reminder. Thank you so much for your help.",
      tone: "formal",
      maxWords: 6,
    };
    const result = rewriteEmailToneNew(request);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.rewrite.truncated).toBe(true);
    expect(result.rewrite.rewrittenBody).toContain("Q3");
    expect(result.rewrite.rewrittenBody).toContain("Friday");
  });

  it("separates preserved key points from the rewritten body", () => {
    const result = rewriteEmailToneNew(FORMAL_FOLLOW_UP);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(Array.isArray(result.rewrite.preservedKeyPoints)).toBe(true);
    expect(result.rewrite.preservedKeyPoints.length).toBeGreaterThan(0);
  });

  it("produces deterministic output for the same draft", () => {
    expect(rewriteEmailToneNew(FRIENDLY_DELAY)).toEqual(rewriteEmailToneNew(FRIENDLY_DELAY));
  });

  it("keeps send, save, and mutate flags disabled", () => {
    const result = rewriteEmailToneNew(FORMAL_FOLLOW_UP);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.rewrite.actions).toEqual({
      canSend: false,
      canSave: false,
      canMutate: false,
    });
  });

  it("rewrites every sample draft in every supported tone", () => {
    for (const tone of SUPPORTED_TONES_NEW) {
      for (const fixture of SAMPLE_DRAFTS) {
        const result = rewriteEmailToneNew({ ...fixture.request, tone });
        expect(result.status).toBe("ok");
      }
    }
  });

  it("maps engine results into ui-friendly ready state", () => {
    expect(toReadyState(rewriteEmailToneNew(FORMAL_FOLLOW_UP)).status).toBe("ready");
    expect(toReadyState(rewriteEmailToneNew(EMPTY_BODY_DRAFT)).status).toBe("error");
  });
});

describe("Email Tone Rewriter guards", () => {
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

  it("rejects oversized subject, body by chars, body by words, or bad maxWords", () => {
    const base: RewriteRequest = {
      subject: "Subjectr",
      bodyText: "A short body.",
      tone: "formal",
    };
    expect(checkRequestLimits({ ...base, subject: "x".repeat(GUARD_LIMITS.maxSubjectChars + 1) })?.code).toBe(
      "input-too-large",
    );
    expect(checkRequestLimits({ ...base, bodyText: "x".repeat(GUARD_LIMITS.maxBodyChars + 1) })?.code).toBe(
      "input-too-large",
    );
    expect(checkRequestLimits({ ...base, bodyText: "word ".repeat(GUARD_LIMITS.maxBodyWords + 1) })?.code).toBe(
      "input-too-large",
    );
    expect(checkRequestLimits({ ...base, maxWords: 0 })?.code).toBe("invalid-length-constraint");
    expect(checkRequestLimits({ ...base, maxWords: -5 })?.code).toBe("invalid-length-constraint");
    expect(checkRequestLimits({ ...base, maxWords: 3.5 })?.code).toBe("invalid-length-constraint");
    expect(
      checkRequestLimits({ ...base, maxWords: GUARD_LIMITS.maxLengthConstraint + 1 })?.code,
    ).toBe("invalid-length-constraint");
  });

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