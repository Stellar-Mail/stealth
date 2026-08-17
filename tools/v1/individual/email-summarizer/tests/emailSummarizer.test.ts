import { describe, expect, it } from "vitest";

import {
  DEFAULT_SUMMARIZER_OPTIONS,
  extractActionItems,
  splitSentences,
  summarizeEmail,
  toReadyState,
  type NormalizedEmail,
} from "../services/emailSummarizer";
import { EMPTY_BODY_EMAIL, SAMPLE_EMAILS } from "../services/fixtures";

const longEmail: NormalizedEmail = SAMPLE_EMAILS[0].email;

describe("summarizeEmail", () => {
  it("summarizes a valid email within the default limits", () => {
    const result = summarizeEmail(longEmail);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.summary.sentenceCount).toBeLessThanOrEqual(
      DEFAULT_SUMMARIZER_OPTIONS.maxSentences,
    );
    expect(result.summary.summary.length).toBeGreaterThan(0);
    expect(result.summary.source.sender).toBe("alex@example.com");
  });

  it("extracts action items separately from the narrative summary", () => {
    const result = summarizeEmail(longEmail);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.summary.actionItems).toContain("Please review the changelog before the demo.");
    expect(result.summary.summary).not.toContain("Please review the changelog");
  });

  it("is deterministic for the same input", () => {
    expect(summarizeEmail(longEmail)).toEqual(summarizeEmail(longEmail));
  });

  it("truncates summaries that exceed the character limit", () => {
    const result = summarizeEmail(longEmail, { maxCharacters: 40 });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.summary.truncated).toBe(true);
    expect(result.summary.summary.length).toBeLessThanOrEqual(40);
  });

  it("returns an error for an empty body", () => {
    const result = summarizeEmail(EMPTY_BODY_EMAIL);

    expect(result.status).toBe("error");
    if (result.status !== "error") return;
    expect(result.code).toBe("empty-body");
  });

  it("returns an error for unsupported input", () => {
    const result = summarizeEmail({ subject: "x" } as unknown as NormalizedEmail);

    expect(result.status).toBe("error");
    if (result.status !== "error") return;
    expect(result.code).toBe("unsupported-input");
  });
});

describe("helpers", () => {
  it("splits text into sentences", () => {
    expect(splitSentences("Hello world. Second one!")).toEqual(["Hello world.", "Second one!"]);
  });

  it("extracts only action-item sentences", () => {
    expect(extractActionItems("Please do this. Nothing here.")).toEqual(["Please do this."]);
  });

  it("maps results into UI states", () => {
    expect(toReadyState(summarizeEmail(longEmail)).status).toBe("ready");
    expect(toReadyState(summarizeEmail(EMPTY_BODY_EMAIL)).status).toBe("error");
  });

  it("summarizes every sample fixture", () => {
    for (const fixture of SAMPLE_EMAILS) {
      expect(summarizeEmail(fixture.email).status).toBe("ok");
    }
  });
});
