import { describe, it, expect } from "vitest";
import { TranslationService } from "../services/translationService";

describe("TranslationService", () => {
  const service = new TranslationService();

  describe("translate", () => {
    it("should successfully translate text", async () => {
      const result = await service.translate({
        text: "Hello world",
        sourceLanguage: "en",
        targetLanguage: "es",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.result.translatedText).toBeDefined();
        expect(result.result.sourceLanguage).toBe("en");
        expect(result.result.targetLanguage).toBe("es");
      }
    });

    it("should reject empty text", async () => {
      const result = await service.translate({
        text: "   ",
        sourceLanguage: "en",
        targetLanguage: "es",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("EMPTY_INPUT");
      }
    });

    it("should reject same source and target language", async () => {
      const result = await service.translate({
        text: "Hello",
        sourceLanguage: "en",
        targetLanguage: "en",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("SAME_LANGUAGE");
      }
    });

    it("should include confidence in successful result", async () => {
      const result = await service.translate({
        text: "Test message",
        sourceLanguage: "en",
        targetLanguage: "fr",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.result.confidence).toBeDefined();
        expect(typeof result.result.confidence).toBe("number");
      }
    });
  });

  describe("detectLanguage", () => {
    it("should detect language from text", async () => {
      const result = await service.detectLanguage("Hello world");

      expect("error" in result).toBe(false);
      if (!("error" in result)) {
        expect(result.language).toBeDefined();
        expect(result.confidence).toBeGreaterThan(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
      }
    });

    it("should reject empty text", async () => {
      const result = await service.detectLanguage("   ");

      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error.code).toBe("EMPTY_INPUT");
      }
    });

    it("should return language code and confidence", async () => {
      const result = await service.detectLanguage("This is a test");

      if (!("error" in result)) {
        expect(typeof result.language).toBe("string");
        expect(result.language.length).toBeGreaterThan(0);
        expect(typeof result.confidence).toBe("number");
      }
    });
  });
});
