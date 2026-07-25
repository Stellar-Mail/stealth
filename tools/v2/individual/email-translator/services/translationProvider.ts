import type { TranslationRequest, TranslationResult } from "../types";

/**
 * Translation provider interface.
 * Implementations can use mock data, local models, or external APIs.
 */
export interface TranslationProvider {
  translate(request: TranslationRequest): Promise<TranslationResult>;
  detectLanguage(text: string): Promise<{ language: string; confidence: number }>;
}

/**
 * Mock translation provider for development and testing.
 * Returns deterministic mock translations without external API calls.
 */
export class MockTranslationProvider implements TranslationProvider {
  async translate(request: TranslationRequest): Promise<TranslationResult> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Mock translation: reverse the text and add language indicators
    const mockTranslation = `[${request.targetLanguage.toUpperCase()}] ${this.reverseWords(request.text)}`;

    return {
      translatedText: mockTranslation,
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
      confidence: 0.95,
    };
  }

  async detectLanguage(text: string): Promise<{ language: string; confidence: number }> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Simple heuristic: detect based on character patterns
    const hasLatin = /[a-zA-Z]/.test(text);
    const hasCyrillic = /[а-яА-Я]/.test(text);
    const hasCJK = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(text);
    const hasArabic = /[\u0600-\u06ff]/.test(text);

    if (hasCJK) {
      return { language: "zh", confidence: 0.85 };
    }
    if (hasCyrillic) {
      return { language: "ru", confidence: 0.9 };
    }
    if (hasArabic) {
      return { language: "ar", confidence: 0.88 };
    }
    if (hasLatin) {
      return { language: "en", confidence: 0.8 };
    }

    return { language: "en", confidence: 0.5 };
  }

  private reverseWords(text: string): string {
    return text
      .split(" ")
      .map((word) => word.split("").reverse().join(""))
      .join(" ");
  }
}

/**
 * Get the configured translation provider.
 * Currently returns mock provider; future implementations can add
 * real providers with configuration.
 */
export function getTranslationProvider(): TranslationProvider {
  return new MockTranslationProvider();
}
