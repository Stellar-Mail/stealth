import { describe, expect, it } from "vitest";
import {
  verificationPurposeSchema,
  verificationTokenHashSchema,
  verificationTokenSchema,
} from "../../../src/server/api/domain";

describe("BETA-005: Verification token domain schemas", () => {
  const baseToken = {
    tokenHash: "a".repeat(64),
    userId: "usr_12345",
    purpose: "email_verification",
    createdAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-01-02T00:00:00.000Z",
    consumedAt: null,
    replacedAt: null,
    replacedByTokenHash: null,
    attemptCount: 0,
    maxAttempts: 5,
  };

  describe("verificationPurposeSchema", () => {
    it("accepts the supported purpose", () => {
      expect(verificationPurposeSchema.parse("email_verification")).toBe("email_verification");
    });

    it("rejects unknown purposes", () => {
      expect(() => verificationPurposeSchema.parse("phone_verification")).toThrow();
    });
  });

  describe("verificationTokenHashSchema", () => {
    it("normalizes to lowercase hex", () => {
      expect(verificationTokenHashSchema.parse("A".repeat(64))).toBe("a".repeat(64));
    });

    it("rejects non-hex or wrong-length hashes", () => {
      expect(() => verificationTokenHashSchema.parse("z".repeat(64))).toThrow();
      expect(() => verificationTokenHashSchema.parse("a".repeat(63))).toThrow();
      expect(() => verificationTokenHashSchema.parse("")).toThrow();
    });
  });

  describe("verificationTokenSchema", () => {
    it("parses a valid token record", () => {
      const parsed = verificationTokenSchema.parse(baseToken);
      expect(parsed).toEqual(baseToken);
    });

    it("accepts consumed and replaced timestamps", () => {
      const parsed = verificationTokenSchema.parse({
        ...baseToken,
        consumedAt: "2026-01-01T01:00:00.000Z",
        replacedAt: "2026-01-01T02:00:00.000Z",
        replacedByTokenHash: "b".repeat(64),
      });
      expect(parsed.consumedAt).toBe("2026-01-01T01:00:00.000Z");
      expect(parsed.replacedByTokenHash).toBe("b".repeat(64));
    });

    it("rejects negative attempt counts", () => {
      expect(() => verificationTokenSchema.parse({ ...baseToken, attemptCount: -1 })).toThrow();
    });

    it("rejects non-positive max attempts", () => {
      expect(() => verificationTokenSchema.parse({ ...baseToken, maxAttempts: 0 })).toThrow();
    });

    it("rejects invalid dates", () => {
      expect(() =>
        verificationTokenSchema.parse({ ...baseToken, expiresAt: "not-a-date" }),
      ).toThrow();
    });
  });
});
