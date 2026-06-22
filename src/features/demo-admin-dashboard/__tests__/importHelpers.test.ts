import { describe, expect, it } from "vitest";
import { parseDatasetJson } from "../utils/importHelpers";
import { validImportJson, invalidImportJson, malformedJson } from "../fixtures/importFixtures";

describe("importHelpers", () => {
  describe("parseDatasetJson", () => {
    it("should successfully parse and validate a valid JSON dataset", () => {
      const result = parseDatasetJson(validImportJson);
      expect(result.success).toBe(true);
      expect(result.dataset?.id).toBe("import-v1");
      expect(result.errors).toHaveLength(0);
    });

    it("should fail on malformed JSON", () => {
      const result = parseDatasetJson(malformedJson);
      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain("Invalid JSON format");
    });

    it("should identify validation errors for invalid data", () => {
      const result = parseDatasetJson(invalidImportJson);
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);

      // Check for specific validation errors
      const nameError = result.errors.find((e) => e.path === "name");
      expect(nameError).toBeDefined();

      const unsafeEmailError = result.errors.find((e) => e.message.includes("safe demo domain"));
      expect(unsafeEmailError).toBeDefined();

      const dateError = result.errors.find((e) => e.path.includes("date"));
      expect(dateError).toBeDefined();

      const recipientsError = result.errors.find((e) => e.path.includes("recipients"));
      expect(recipientsError).toBeDefined();
    });
  });
});
