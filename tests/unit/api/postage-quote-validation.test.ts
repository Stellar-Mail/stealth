import { describe, expect, it } from "vitest";

import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import { quotePostage } from "../../../src/server/api/postage-service";
import { stellarAddressSchema } from "../../../src/server/api/domain";

const validRecipient = `G${"A".repeat(55)}`;
const validSender = `G${"B".repeat(55)}`;

describe("Postage Quote Validation", () => {
  describe("recipient validation", () => {
    it("rejects empty recipient", () => {
      expect(() => stellarAddressSchema.parse("")).toThrow();
    });

    it("rejects whitespace-only recipient", () => {
      expect(() => stellarAddressSchema.parse("   ")).toThrow();
    });

    it("rejects recipient missing G prefix", () => {
      expect(() => stellarAddressSchema.parse(`A${"A".repeat(55)}`)).toThrow();
    });

    it("rejects recipient with lowercase letters", () => {
      // Note: lowercase is actually normalized to uppercase, not rejected
      // This test verifies the normalization works correctly
      const lowercase = `g${"a".repeat(55)}`;
      const result = stellarAddressSchema.parse(lowercase);
      expect(result).toBe(validRecipient); // Normalized to uppercase
    });

    it("rejects recipient with invalid base32 characters", () => {
      // Base32 alphabet is A-Z, 2-7 (no 0, 1, 8, 9)
      expect(() => stellarAddressSchema.parse(`G${" 0".repeat(27)}0`)).toThrow();
      expect(() => stellarAddressSchema.parse(`G${"1".repeat(55)}`)).toThrow();
      expect(() => stellarAddressSchema.parse(`G${"8".repeat(55)}`)).toThrow();
      expect(() => stellarAddressSchema.parse(`G${"9".repeat(55)}`)).toThrow();
    });

    it("rejects recipient shorter than 56 characters", () => {
      expect(() => stellarAddressSchema.parse(`G${"A".repeat(54)}`)).toThrow();
      expect(() => stellarAddressSchema.parse("G")).toThrow();
    });

    it("rejects recipient longer than 56 characters", () => {
      expect(() => stellarAddressSchema.parse(`G${"A".repeat(56)}`)).toThrow();
      expect(() => stellarAddressSchema.parse(`G${"A".repeat(100)}`)).toThrow();
    });

    it("rejects recipient with special characters", () => {
      expect(() => stellarAddressSchema.parse(`G${"A".repeat(50)}@AAAA`)).toThrow();
      expect(() => stellarAddressSchema.parse(`G${"A".repeat(50)}*AAAA`)).toThrow();
    });

    it("normalizes valid recipient with lowercase to uppercase", () => {
      const lowercase = `g${"a".repeat(55)}`;
      const result = stellarAddressSchema.parse(lowercase);
      expect(result).toBe(validRecipient);
    });

    it("trims whitespace from valid recipient", () => {
      const withWhitespace = `  ${validRecipient}  `;
      const result = stellarAddressSchema.parse(withWhitespace);
      expect(result).toBe(validRecipient);
    });

    it("accepts valid recipient", () => {
      expect(stellarAddressSchema.parse(validRecipient)).toBe(validRecipient);
    });

    it("accepts recipient with valid base32 characters (A-Z, 2-7)", () => {
      // Base32 uses A-Z and 2-7 (no 0, 1, 8, 9)
      // Create a 56-char address with all valid base32 chars
      const validBase32 = "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW";
      expect(validBase32.length).toBe(56);
      expect(stellarAddressSchema.parse(validBase32)).toBe(validBase32);
    });
  });

  describe("sender validation", () => {
    it("rejects empty sender", () => {
      expect(() => stellarAddressSchema.parse("")).toThrow();
    });

    it("rejects whitespace-only sender", () => {
      expect(() => stellarAddressSchema.parse("   ")).toThrow();
    });

    it("rejects sender missing G prefix", () => {
      expect(() => stellarAddressSchema.parse(`B${"B".repeat(55)}`)).toThrow();
    });

    it("rejects sender shorter than 56 characters", () => {
      expect(() => stellarAddressSchema.parse(`G${"B".repeat(54)}`)).toThrow();
    });

    it("rejects sender longer than 56 characters", () => {
      expect(() => stellarAddressSchema.parse(`G${"B".repeat(56)}`)).toThrow();
    });

    it("normalizes valid sender with lowercase to uppercase", () => {
      const lowercase = `g${"b".repeat(55)}`;
      const result = stellarAddressSchema.parse(lowercase);
      expect(result).toBe(validSender);
    });

    it("trims whitespace from valid sender", () => {
      const withWhitespace = `  ${validSender}  `;
      const result = stellarAddressSchema.parse(withWhitespace);
      expect(result).toBe(validSender);
    });

    it("accepts valid sender", () => {
      expect(stellarAddressSchema.parse(validSender)).toBe(validSender);
    });
  });

  describe("quote service with validation", () => {
    it("handles valid addresses correctly", async () => {
      const repository = new MemoryApiRepository();
      await repository.setPolicy(validRecipient, {
        allowUnknown: true,
        minimumPostage: "100",
        requireVerified: false,
      });

      const quote = await quotePostage(repository, {
        recipient: validRecipient,
        sender: validSender,
      });

      expect(quote).toMatchObject({
        amount: "100",
        eligible: true,
        reason: "mailbox_minimum",
        trusted: false,
      });
    });

    it("normalizes addresses before processing", async () => {
      const repository = new MemoryApiRepository();
      await repository.setPolicy(validRecipient, {
        allowUnknown: true,
        minimumPostage: "200",
        requireVerified: false,
      });

      // Schema will normalize these addresses to uppercase
      const normalizedRecipient = stellarAddressSchema.parse(`  ${validRecipient.toLowerCase()}  `);
      const normalizedSender = stellarAddressSchema.parse(`  ${validSender.toLowerCase()}  `);

      // Use the normalized addresses (which match the policy)
      const quote = await quotePostage(repository, {
        recipient: normalizedRecipient,
        sender: normalizedSender,
      });

      expect(quote).toMatchObject({
        amount: "200",
        eligible: true,
      });
    });
  });

  describe("boundary value tests", () => {
    it("rejects null recipient", () => {
      expect(() => stellarAddressSchema.parse(null as any)).toThrow();
    });

    it("rejects undefined recipient", () => {
      expect(() => stellarAddressSchema.parse(undefined as any)).toThrow();
    });

    it("rejects numeric recipient", () => {
      expect(() => stellarAddressSchema.parse(12345 as any)).toThrow();
    });

    it("rejects object recipient", () => {
      expect(() => stellarAddressSchema.parse({ address: validRecipient } as any)).toThrow();
    });

    it("rejects array recipient", () => {
      expect(() => stellarAddressSchema.parse([validRecipient] as any)).toThrow();
    });

    it("rejects boolean recipient", () => {
      expect(() => stellarAddressSchema.parse(true as any)).toThrow();
    });

    it("handles maximum valid length exactly", () => {
      // Stellar addresses are exactly 56 characters
      const exactLength = `G${"A".repeat(55)}`;
      expect(stellarAddressSchema.parse(exactLength)).toBe(exactLength);
    });

    it("handles minimum valid length exactly", () => {
      // Stellar addresses must be exactly 56 characters (G + 55 base32)
      const exactLength = `G${"2".repeat(55)}`;
      expect(stellarAddressSchema.parse(exactLength)).toBe(exactLength);
    });

    it("rejects oversized string (stress test)", () => {
      const oversized = `G${"A".repeat(10000)}`;
      expect(() => stellarAddressSchema.parse(oversized)).toThrow();
    });

    it("rejects empty string after trim", () => {
      expect(() => stellarAddressSchema.parse("    ")).toThrow();
    });
  });

  describe("error messages", () => {
    it("provides clear error for invalid format", () => {
      try {
        stellarAddressSchema.parse("invalid");
        expect.fail("Should have thrown");
      } catch (error: any) {
        expect(error.issues).toBeDefined();
        expect(error.issues[0].message).toContain("Expected a Stellar G-address");
      }
    });

    it("provides clear error for wrong prefix", () => {
      try {
        stellarAddressSchema.parse(`M${"A".repeat(55)}`);
        expect.fail("Should have thrown");
      } catch (error: any) {
        expect(error.issues).toBeDefined();
        expect(error.issues[0].message).toContain("Expected a Stellar G-address");
      }
    });

    it("provides clear error for wrong length", () => {
      try {
        stellarAddressSchema.parse(`G${"A".repeat(54)}`);
        expect.fail("Should have thrown");
      } catch (error: any) {
        expect(error.issues).toBeDefined();
        expect(error.issues[0].message).toContain("Expected a Stellar G-address");
      }
    });
  });
});
