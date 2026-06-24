import { describe, expect, it } from "vitest";
import {
  extractPreservedKeyPoints,
  rewriteEmailTone,
  SUPPORTED_TONES,
  validateRewriteInput,
} from "./services";

describe("Email Tone Rewriter core service", () => {
  it("supports the documented V1 tones", () => {
    expect(SUPPORTED_TONES).toEqual(["concise", "friendly", "formal", "apologetic"]);
  });

  it("rewrites a draft into a selected tone without enabling send or save actions", () => {
    const result = rewriteEmailTone({
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

  it("preserves key names, dates, amounts, links, and request sentences for review", () => {
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
    const result = rewriteEmailTone({
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
