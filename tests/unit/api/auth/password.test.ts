import { describe, expect, it } from "vitest";
import {
  constantTimeCompare,
  dummyVerifyPassword,
  hashPassword,
  verifyPassword,
} from "../../../../src/server/api/auth/password";

describe("BETA-006: Password Hashing & Constant-Time Utilities", () => {
  describe("constantTimeCompare", () => {
    it("returns true for identical strings", () => {
      expect(constantTimeCompare("secret-token-123", "secret-token-123")).toBe(true);
      expect(constantTimeCompare("", "")).toBe(true);
    });

    it("returns false for different strings of equal length", () => {
      expect(constantTimeCompare("secret-token-123", "secret-token-124")).toBe(false);
    });

    it("returns false for strings of different lengths", () => {
      expect(constantTimeCompare("secret", "secret-longer")).toBe(false);
    });
  });

  describe("hashPassword & verifyPassword", () => {
    it("hashes and verifies a valid password", async () => {
      const password = "CorrectHorseBatteryStaple!99";
      const { hash, salt } = await hashPassword(password);

      expect(hash).toHaveLength(64); // SHA-256 hex output
      expect(salt).toHaveLength(32); // 16 bytes hex output

      const isValid = await verifyPassword(password, hash, salt);
      expect(isValid).toBe(true);
    });

    it("rejects an incorrect password", async () => {
      const password = "CorrectHorseBatteryStaple!99";
      const wrongPassword = "WrongPassword!00";
      const { hash, salt } = await hashPassword(password);

      const isValid = await verifyPassword(wrongPassword, hash, salt);
      expect(isValid).toBe(false);
    });
  });

  describe("dummyVerifyPassword", () => {
    it("always returns false and executes hash computation", async () => {
      const start = performance.now();
      const isValid = await dummyVerifyPassword("SomeRandomPassword123!");
      const duration = performance.now() - start;

      expect(isValid).toBe(false);
      expect(duration).toBeGreaterThan(0);
    });
  });
});
