import { describe, expect, it } from "vitest";

import type { TranslationRequest, TranslationResult } from "../types";
import type { TranslationProvider } from "../services/translationProvider";
import {
  createEmailTranslationCore,
  SUPPORTED_LANGUAGE_CODES,
} from "../services/emailTranslationCore";

/** Deterministic in-memory provider: uppercases the text, no network. */
const fakeProvider: TranslationProvider = {
  async translate(request: TranslationRequest): Promise<TranslationResult> {
    return {
      translatedText: request.text.toUpperCase(),
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
      confidence: 1,
    };
  },
  async detectLanguage() {
    return { language: "en", confidence: 1 };
  },
};

const core = createEmailTranslationCore(fakeProvider);

describe("emailTranslationCore (#495)", () => {
  it("translates non-quoted lines and preserves quoted lines verbatim", async () => {
    const body = "Hello team\n> On Monday Bob wrote:\n> can you review?\nThanks";
    const res = await core.translateBody(body, { targetLanguage: "es" });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const lines = res.translatedBody.split("\n");
      expect(lines[0]).toBe("HELLO TEAM"); // translated
      expect(lines[1]).toBe("> On Monday Bob wrote:"); // preserved
      expect(lines[2]).toBe("> can you review?"); // preserved
      expect(lines[3]).toBe("THANKS"); // translated
      expect(res.translatedLineCount).toBe(2);
      expect(res.preservedLineCount).toBe(2);
    }
  });

  it("preserves blank lines", async () => {
    const body = "Line one\n\nLine two";
    const res = await core.translateBody(body, { targetLanguage: "fr" });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.translatedBody).toBe("LINE ONE\n\nLINE TWO");
      expect(res.preservedLineCount).toBe(1);
    }
  });

  it("rejects an empty body", async () => {
    const res = await core.translateBody("   ", { targetLanguage: "es" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("EMPTY_BODY");
  });

  it("rejects an unsupported target language", async () => {
    const res = await core.translateBody("Hi", { targetLanguage: "xx" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("UNSUPPORTED_TARGET_LANGUAGE");
  });

  it("rejects an unsupported source language", async () => {
    const res = await core.translateBody("Hi", { sourceLanguage: "xx", targetLanguage: "es" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("UNSUPPORTED_SOURCE_LANGUAGE");
  });

  it("exposes the supported language catalog", () => {
    expect(SUPPORTED_LANGUAGE_CODES).toContain("en");
    expect(SUPPORTED_LANGUAGE_CODES).toContain("zh");
    expect(SUPPORTED_LANGUAGE_CODES.length).toBeGreaterThan(10);
  });

  it("is deterministic for identical input + provider", async () => {
    const opts = { targetLanguage: "de" };
    const a = await core.translateBody("translate me", opts);
    const b = await core.translateBody("translate me", opts);
    expect(a).toEqual(b);
  });
});
