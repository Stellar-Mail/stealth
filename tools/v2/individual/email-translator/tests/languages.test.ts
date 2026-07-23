import { describe, it, expect } from "vitest";
import { SUPPORTED_LANGUAGES, getLanguageByCode, getLanguageDisplayName } from "../services";

describe("Languages", () => {
  describe("SUPPORTED_LANGUAGES", () => {
    it("should contain common languages", () => {
      expect(SUPPORTED_LANGUAGES.length).toBeGreaterThan(0);

      const codes = SUPPORTED_LANGUAGES.map((lang) => lang.code);
      expect(codes).toContain("en");
      expect(codes).toContain("es");
      expect(codes).toContain("fr");
      expect(codes).toContain("de");
    });

    it("should have valid structure for each language", () => {
      SUPPORTED_LANGUAGES.forEach((lang) => {
        expect(lang.code).toBeDefined();
        expect(lang.name).toBeDefined();
        expect(lang.nativeName).toBeDefined();
        expect(typeof lang.code).toBe("string");
        expect(typeof lang.name).toBe("string");
        expect(typeof lang.nativeName).toBe("string");
      });
    });

    it("should have unique language codes", () => {
      const codes = SUPPORTED_LANGUAGES.map((lang) => lang.code);
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(codes.length);
    });
  });

  describe("getLanguageByCode", () => {
    it("should return language for valid code", () => {
      const english = getLanguageByCode("en");
      expect(english).toBeDefined();
      expect(english?.name).toBe("English");
    });

    it("should return undefined for invalid code", () => {
      const invalid = getLanguageByCode("invalid");
      expect(invalid).toBeUndefined();
    });

    it("should work with all supported language codes", () => {
      SUPPORTED_LANGUAGES.forEach((lang) => {
        const found = getLanguageByCode(lang.code);
        expect(found).toBeDefined();
        expect(found?.code).toBe(lang.code);
      });
    });
  });

  describe("getLanguageDisplayName", () => {
    it("should return native name when same as English name", () => {
      const english = { code: "en", name: "English", nativeName: "English" };
      expect(getLanguageDisplayName(english)).toBe("English");
    });

    it("should return both names when different", () => {
      const spanish = { code: "es", name: "Spanish", nativeName: "Español" };
      expect(getLanguageDisplayName(spanish)).toBe("Español (Spanish)");
    });

    it("should work with all supported languages", () => {
      SUPPORTED_LANGUAGES.forEach((lang) => {
        const displayName = getLanguageDisplayName(lang);
        expect(displayName).toBeDefined();
        expect(displayName.length).toBeGreaterThan(0);
      });
    });
  });
});
