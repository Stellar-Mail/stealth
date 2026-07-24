import type { TranslationRequest, TranslationResult, TranslationError } from "../types";
import { getTranslationProvider } from "./translationProvider";

/**
 * Translation service result wrapper.
 */
export type TranslationServiceResult =
  | { success: true; result: TranslationResult }
  | { success: false; error: TranslationError };

/**
 * Orchestrates translation requests.
 * Validates input, selects provider, normalizes errors.
 */
export class TranslationService {
  private provider = getTranslationProvider();

  /**
   * Translate text from source to target language.
   */
  async translate(request: TranslationRequest): Promise<TranslationServiceResult> {
    try {
      // Validate input
      if (!request.text.trim()) {
        return {
          success: false,
          error: {
            code: "EMPTY_INPUT",
            message: "Translation text cannot be empty",
          },
        };
      }

      if (request.sourceLanguage === request.targetLanguage) {
        return {
          success: false,
          error: {
            code: "SAME_LANGUAGE",
            message: "Source and target languages must be different",
          },
        };
      }

      // Perform translation
      const result = await this.provider.translate(request);

      return { success: true, result };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "TRANSLATION_FAILED",
          message: "Translation request failed",
          details: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }
  }

  /**
   * Detect the language of the provided text.
   */
  async detectLanguage(
    text: string,
  ): Promise<{ language: string; confidence: number } | { error: TranslationError }> {
    try {
      if (!text.trim()) {
        return {
          error: {
            code: "EMPTY_INPUT",
            message: "Cannot detect language from empty text",
          },
        };
      }

      const result = await this.provider.detectLanguage(text);
      return result;
    } catch (error) {
      return {
        error: {
          code: "DETECTION_FAILED",
          message: "Language detection failed",
          details: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }
  }
}

/**
 * Singleton instance of the translation service.
 */
export const translationService = new TranslationService();
