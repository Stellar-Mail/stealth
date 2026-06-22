import { describe, expect, it } from "vitest";

import {
  SUPPORTED_TONES,
  capitalizeSentences,
  rewriteEmailTone,
  splitSentences,
  toReadyState,
  type RewriteRequest,
} from "../services/emailToneRewriter";
import {
  EMPTY_BODY_DRAFT,
  FORMAL_FOLLOW_UP,
  FRIENDLY_DELAY,
  SAMPLE_DRAFTS,
  UNSUPPORTED_TONE_DRAFT,
} from "../services/fixtures";

describe("rewriteEmailTone", () => {
  it("rewrites into the formal tone while preserving key facts", () => {
    const result = rewriteEmailTone(FORMAL_FOLLOW_UP);

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
    const result = rewriteEmailTone(FRIENDLY_DELAY);

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
    const result = rewriteEmailTone(request);

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
    const result = rewriteEmailTone(draft);

    expect(result.status).toBe("error");
    if (result.status !== "error") return;
    expect(result.code).toBe("unsupported-tone");
    expect(rewriteEmailTone(draft)).toEqual(result);
  });

  it("rejects an empty draft body", () => {
    const result = rewriteEmailTone(EMPTY_BODY_DRAFT);

    expect(result.status).toBe("error");
    if (result.status !== "error") return;
    expect(result.code).toBe("empty-body");
  });

  it("rejects malformed input", () => {
    const result = rewriteEmailTone({
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
    const result = rewriteEmailTone(request);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.rewrite.truncated).toBe(true);
    expect(result.rewrite.rewrittenBody).toContain("Q3");
    expect(result.rewrite.rewrittenBody).toContain("Friday");
  });

  it("separates preserved key points from the rewritten body", () => {
    const result = rewriteEmailTone(FORMAL_FOLLOW_UP);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(Array.isArray(result.rewrite.preservedKeyPoints)).toBe(true);
    expect(result.rewrite.preservedKeyPoints.length).toBeGreaterThan(0);
  });

  it("produces deterministic output for the same draft", () => {
    expect(rewriteEmailTone(FRIENDLY_DELAY)).toEqual(rewriteEmailTone(FRIENDLY_DELAY));
  });

  it("keeps send, save, and mutate flags disabled", () => {
    const result = rewriteEmailTone(FORMAL_FOLLOW_UP);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.rewrite.actions).toEqual({
      canSend: false,
      canSave: false,
      canMutate: false,
    });
  });

  it("rewrites every sample draft in every supported tone", () => {
    for (const tone of SUPPORTED_TONES) {
      for (const fixture of SAMPLE_DRAFTS) {
        const result = rewriteEmailTone({ ...fixture.request, tone });
        expect(result.status).toBe("ok");
      }
    }
  });
});

describe("helpers", () => {
  it("splits text into sentences", () => {
    expect(splitSentences("One. Two!")).toEqual(["One.", "Two!"]);
  });

  it("capitalizes sentence beginnings", () => {
    expect(capitalizeSentences("hello there. how are you?")).toBe("Hello there. How are you?");
  });

  it("maps results into UI states", () => {
    expect(toReadyState(rewriteEmailTone(FORMAL_FOLLOW_UP)).status).toBe("ready");
    expect(toReadyState(rewriteEmailTone(EMPTY_BODY_DRAFT)).status).toBe("error");
  });
});
