import { describe, expect, it } from "vitest";

import {
  createEmailTranslationCore,
  SUPPORTED_LANGUAGE_CODES,
} from "../services/emailTranslationCore";
import type { TranslationProvider } from "../services/translationProvider";
import type { TranslationRequest, TranslationResult } from "../types";

/**
 * Deterministic, dependency-free translation provider for tests.
 *
 * The bundled MockTranslationProvider sleeps 800ms per line and reverses words,
 * which makes assertions slow and awkward. This fake resolves immediately and
 * echoes the input with a visible target-language tag, so the tests can assert
 * exactly which lines were translated and which were preserved.
 */
class FakeTranslationProvider implements TranslationProvider {
  public readonly requests: TranslationRequest[] = [];

  constructor(private readonly detectedLanguage?: string) {}

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    this.requests.push(request);
    return {
      translatedText: `<${request.targetLanguage}>${request.text}`,
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
      detectedLanguage: this.detectedLanguage,
      confidence: 1,
    };
  }

  async detectLanguage(): Promise<{ language: string; confidence: number }> {
    return { language: this.detectedLanguage ?? "en", confidence: 1 };
  }
}

describe("createEmailTranslationCore", () => {
  it("rejects an empty or whitespace-only body", async () => {
    const core = createEmailTranslationCore(new FakeTranslationProvider());

    for (const body of ["", "   ", "\n\n", "  \n \t\n"]) {
      const result = await core.translateBody(body, { targetLanguage: "fr" });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("EMPTY_BODY");
      }
    }
  });

  it("rejects an unsupported target language", async () => {
    const core = createEmailTranslationCore(new FakeTranslationProvider());

    const result = await core.translateBody("Hello", { targetLanguage: "xx" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("UNSUPPORTED_TARGET_LANGUAGE");
    }
  });

  it("rejects an unsupported source language when one is provided", async () => {
    const core = createEmailTranslationCore(new FakeTranslationProvider());

    const result = await core.translateBody("Hello", {
      sourceLanguage: "xx",
      targetLanguage: "fr",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("UNSUPPORTED_SOURCE_LANGUAGE");
    }
  });

  it("translates content lines and preserves quotes and blank lines verbatim", async () => {
    const fake = new FakeTranslationProvider();
    const core = createEmailTranslationCore(fake);

    const body = [
      "Hello there,",
      "",
      "> On Monday you wrote:",
      ">> nested quote",
      "  > indented quote",
      "Please review the draft.",
    ].join("\n");

    const result = await core.translateBody(body, { targetLanguage: "fr" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.translatedLineCount).toBe(2);
    expect(result.preservedLineCount).toBe(4);
    expect(result.translatedBody.split("\n")).toEqual([
      "<fr>Hello there,",
      "",
      "> On Monday you wrote:",
      ">> nested quote",
      "  > indented quote",
      "<fr>Please review the draft.",
    ]);

    // Only the two content lines are sent to the provider.
    expect(fake.requests.map((request) => request.text)).toEqual([
      "Hello there,",
      "Please review the draft.",
    ]);
  });

  it("defaults the source language to auto and forwards an explicit source", async () => {
    const autoFake = new FakeTranslationProvider();
    const autoCore = createEmailTranslationCore(autoFake);
    await autoCore.translateBody("Hello", { targetLanguage: "fr" });
    expect(autoFake.requests[0]?.sourceLanguage).toBe("auto");

    const explicitFake = new FakeTranslationProvider();
    const explicitCore = createEmailTranslationCore(explicitFake);
    await explicitCore.translateBody("Hello", {
      sourceLanguage: "en",
      targetLanguage: "fr",
    });
    expect(explicitFake.requests[0]?.sourceLanguage).toBe("en");
  });

  it("propagates a detected language reported by the provider", async () => {
    const core = createEmailTranslationCore(new FakeTranslationProvider("de"));

    const result = await core.translateBody("Guten Tag", { targetLanguage: "en" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.detectedLanguage).toBe("de");
  });

  it("preserves an all-quoted body without calling the provider", async () => {
    const fake = new FakeTranslationProvider();
    const core = createEmailTranslationCore(fake);

    const body = ["> quoted one", "> quoted two"].join("\n");
    const result = await core.translateBody(body, { targetLanguage: "fr" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.translatedLineCount).toBe(0);
    expect(result.preservedLineCount).toBe(2);
    expect(result.translatedBody).toBe(body);
    expect(fake.requests).toHaveLength(0);
  });

  it("exposes the supported language codes catalog", () => {
    expect(SUPPORTED_LANGUAGE_CODES).toContain("en");
    expect(SUPPORTED_LANGUAGE_CODES).toContain("fr");
    expect(SUPPORTED_LANGUAGE_CODES).toContain("zh-TW");
    expect(SUPPORTED_LANGUAGE_CODES).not.toContain("xx");
  });
});
