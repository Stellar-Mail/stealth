import { describe, expect, it } from "vitest";
import { z } from "zod";

import { stellarAddressSchema } from "../../../src/server/api/domain";
import { ApiError, normalizeApiError } from "../../../src/server/api/errors";

const validRecipient = `G${"A".repeat(55)}`;
const validSender = `G${"B".repeat(55)}`;

const quoteSchema = z.object({
  recipient: stellarAddressSchema,
  sender: stellarAddressSchema,
});

describe("Postage Quote Endpoint Validation", () => {
  describe("HTTP 422 validation errors for invalid identifiers", () => {
    it("returns validation error for empty recipient", () => {
      try {
        quoteSchema.parse({ recipient: "", sender: validSender });
        expect.fail("Should have thrown validation error");
      } catch (error) {
        const apiError = normalizeApiError(error);
        expect(apiError.status).toBe(422);
        expect(apiError.code).toBe("validation_error");
        expect(apiError.message).toBe("Request validation failed");
      }
    });

    it("returns validation error for empty sender", () => {
      try {
        quoteSchema.parse({ recipient: validRecipient, sender: "" });
        expect.fail("Should have thrown validation error");
      } catch (error) {
        const apiError = normalizeApiError(error);
        expect(apiError.status).toBe(422);
        expect(apiError.code).toBe("validation_error");
      }
    });

    it("returns validation error for malformed recipient (wrong prefix)", () => {
      try {
        quoteSchema.parse({ recipient: `M${"A".repeat(55)}`, sender: validSender });
        expect.fail("Should have thrown validation error");
      } catch (error) {
        const apiError = normalizeApiError(error);
        expect(apiError.status).toBe(422);
        expect(apiError.code).toBe("validation_error");
      }
    });

    it("returns validation error for malformed sender (wrong prefix)", () => {
      try {
        quoteSchema.parse({ recipient: validRecipient, sender: `X${"B".repeat(55)}` });
        expect.fail("Should have thrown validation error");
      } catch (error) {
        const apiError = normalizeApiError(error);
        expect(apiError.status).toBe(422);
        expect(apiError.code).toBe("validation_error");
      }
    });

    it("returns validation error for recipient with invalid base32 characters", () => {
      try {
        quoteSchema.parse({
          recipient: `G${"0".repeat(55)}`,
          sender: validSender,
        });
        expect.fail("Should have thrown validation error");
      } catch (error) {
        const apiError = normalizeApiError(error);
        expect(apiError.status).toBe(422);
        expect(apiError.code).toBe("validation_error");
      }
    });

    it("returns validation error for oversized recipient", () => {
      try {
        quoteSchema.parse({
          recipient: `G${"A".repeat(100)}`,
          sender: validSender,
        });
        expect.fail("Should have thrown validation error");
      } catch (error) {
        const apiError = normalizeApiError(error);
        expect(apiError.status).toBe(422);
        expect(apiError.code).toBe("validation_error");
      }
    });

    it("returns validation error for oversized sender", () => {
      try {
        quoteSchema.parse({
          recipient: validRecipient,
          sender: `G${"B".repeat(1000)}`,
        });
        expect.fail("Should have thrown validation error");
      } catch (error) {
        const apiError = normalizeApiError(error);
        expect(apiError.status).toBe(422);
        expect(apiError.code).toBe("validation_error");
      }
    });

    it("returns validation error for undersized recipient", () => {
      try {
        quoteSchema.parse({
          recipient: `G${"A".repeat(10)}`,
          sender: validSender,
        });
        expect.fail("Should have thrown validation error");
      } catch (error) {
        const apiError = normalizeApiError(error);
        expect(apiError.status).toBe(422);
        expect(apiError.code).toBe("validation_error");
      }
    });

    it("returns validation error for undersized sender", () => {
      try {
        quoteSchema.parse({
          recipient: validRecipient,
          sender: "G",
        });
        expect.fail("Should have thrown validation error");
      } catch (error) {
        const apiError = normalizeApiError(error);
        expect(apiError.status).toBe(422);
        expect(apiError.code).toBe("validation_error");
      }
    });

    it("returns validation error for recipient with special characters", () => {
      try {
        quoteSchema.parse({
          recipient: `G${"A".repeat(50)}@AAAA`,
          sender: validSender,
        });
        expect.fail("Should have thrown validation error");
      } catch (error) {
        const apiError = normalizeApiError(error);
        expect(apiError.status).toBe(422);
        expect(apiError.code).toBe("validation_error");
      }
    });

    it("returns validation error for sender with special characters", () => {
      try {
        quoteSchema.parse({
          recipient: validRecipient,
          sender: `G${"B".repeat(50)}*BBBB`,
        });
        expect.fail("Should have thrown validation error");
      } catch (error) {
        const apiError = normalizeApiError(error);
        expect(apiError.status).toBe(422);
        expect(apiError.code).toBe("validation_error");
      }
    });

    it("returns validation error for null recipient", () => {
      try {
        quoteSchema.parse({ recipient: null as any, sender: validSender });
        expect.fail("Should have thrown validation error");
      } catch (error) {
        const apiError = normalizeApiError(error);
        expect(apiError.status).toBe(422);
        expect(apiError.code).toBe("validation_error");
      }
    });

    it("returns validation error for undefined recipient", () => {
      try {
        quoteSchema.parse({ recipient: undefined as any, sender: validSender });
        expect.fail("Should have thrown validation error");
      } catch (error) {
        const apiError = normalizeApiError(error);
        expect(apiError.status).toBe(422);
        expect(apiError.code).toBe("validation_error");
      }
    });

    it("returns validation error for numeric recipient", () => {
      try {
        quoteSchema.parse({ recipient: 12345 as any, sender: validSender });
        expect.fail("Should have thrown validation error");
      } catch (error) {
        const apiError = normalizeApiError(error);
        expect(apiError.status).toBe(422);
        expect(apiError.code).toBe("validation_error");
      }
    });

    it("returns validation error for object recipient", () => {
      try {
        quoteSchema.parse({
          recipient: { address: validRecipient } as any,
          sender: validSender,
        });
        expect.fail("Should have thrown validation error");
      } catch (error) {
        const apiError = normalizeApiError(error);
        expect(apiError.status).toBe(422);
        expect(apiError.code).toBe("validation_error");
      }
    });

    it("returns validation error for array recipient", () => {
      try {
        quoteSchema.parse({
          recipient: [validRecipient] as any,
          sender: validSender,
        });
        expect.fail("Should have thrown validation error");
      } catch (error) {
        const apiError = normalizeApiError(error);
        expect(apiError.status).toBe(422);
        expect(apiError.code).toBe("validation_error");
      }
    });

    it("returns validation error for both invalid recipient and sender", () => {
      try {
        quoteSchema.parse({
          recipient: "invalid",
          sender: "also-invalid",
        });
        expect.fail("Should have thrown validation error");
      } catch (error) {
        const apiError = normalizeApiError(error);
        expect(apiError.status).toBe(422);
        expect(apiError.code).toBe("validation_error");
        // Should include errors for both fields
        expect(apiError.details).toBeDefined();
      }
    });
  });

  describe("valid requests preserve existing response shape", () => {
    it("accepts valid recipient and sender", () => {
      const result = quoteSchema.parse({
        recipient: validRecipient,
        sender: validSender,
      });
      expect(result).toEqual({
        recipient: validRecipient,
        sender: validSender,
      });
    });

    it("normalizes lowercase addresses to uppercase", () => {
      const result = quoteSchema.parse({
        recipient: validRecipient.toLowerCase(),
        sender: validSender.toLowerCase(),
      });
      expect(result).toEqual({
        recipient: validRecipient,
        sender: validSender,
      });
    });

    it("trims whitespace from addresses", () => {
      const result = quoteSchema.parse({
        recipient: `  ${validRecipient}  `,
        sender: `  ${validSender}  `,
      });
      expect(result).toEqual({
        recipient: validRecipient,
        sender: validSender,
      });
    });

    it("handles combined normalization (lowercase + whitespace)", () => {
      const result = quoteSchema.parse({
        recipient: `  ${validRecipient.toLowerCase()}  `,
        sender: `  ${validSender.toLowerCase()}  `,
      });
      expect(result).toEqual({
        recipient: validRecipient,
        sender: validSender,
      });
    });

    it("accepts addresses with all valid base32 characters", () => {
      // Base32 uses A-Z and 2-7 (no 0, 1, 8, 9)
      const validBase32Recipient = "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW";
      const validBase32Sender = "G234567ABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQ";

      expect(validBase32Recipient.length).toBe(56);
      expect(validBase32Sender.length).toBe(56);

      const result = quoteSchema.parse({
        recipient: validBase32Recipient,
        sender: validBase32Sender,
      });

      expect(result).toEqual({
        recipient: validBase32Recipient,
        sender: validBase32Sender,
      });
    });
  });

  describe("deterministic error responses", () => {
    it("returns consistent error code for validation failures", () => {
      const testCases = [
        { recipient: "", sender: validSender },
        { recipient: "invalid", sender: validSender },
        { recipient: `G${"A".repeat(100)}`, sender: validSender },
        { recipient: validRecipient, sender: "" },
        { recipient: validRecipient, sender: "invalid" },
      ];

      testCases.forEach((testCase) => {
        try {
          quoteSchema.parse(testCase);
          expect.fail(`Should have thrown for ${JSON.stringify(testCase)}`);
        } catch (error) {
          const apiError = normalizeApiError(error);
          expect(apiError.status).toBe(422);
          expect(apiError.code).toBe("validation_error");
          expect(apiError.message).toBe("Request validation failed");
        }
      });
    });

    it("includes field-specific error details", () => {
      try {
        quoteSchema.parse({ recipient: "invalid", sender: validSender });
        expect.fail("Should have thrown validation error");
      } catch (error) {
        const apiError = normalizeApiError(error);
        expect(apiError.details).toBeDefined();

        // Verify details use the stable application-owned validation schema.
        const details = apiError.details as any;
        expect(details.validationErrors).toEqual([
          expect.objectContaining({
            path: "recipient",
            rule: "format",
            message: expect.any(String),
          }),
        ]);
        expect(details.fieldErrors).toBeUndefined();
      }
    });
  });

  describe("boundary value stress tests", () => {
    it("handles extremely large strings efficiently", () => {
      const hugeString = `G${"A".repeat(1000000)}`; // 1M+ chars

      try {
        quoteSchema.parse({ recipient: hugeString, sender: validSender });
        expect.fail("Should have thrown validation error");
      } catch (error) {
        const apiError = normalizeApiError(error);
        expect(apiError.status).toBe(422);
        expect(apiError.code).toBe("validation_error");
      }
    });

    it("handles exactly 56 characters (valid boundary)", () => {
      const exactLength = `G${"A".repeat(55)}`;
      const result = quoteSchema.parse({
        recipient: exactLength,
        sender: validSender,
      });
      expect(result.recipient).toBe(exactLength);
    });

    it("handles 55 characters (one below valid boundary)", () => {
      const tooShort = `G${"A".repeat(54)}`;
      try {
        quoteSchema.parse({ recipient: tooShort, sender: validSender });
        expect.fail("Should have thrown validation error");
      } catch (error) {
        const apiError = normalizeApiError(error);
        expect(apiError.status).toBe(422);
        expect(apiError.code).toBe("validation_error");
      }
    });

    it("handles 57 characters (one above valid boundary)", () => {
      const tooLong = `G${"A".repeat(56)}`;
      try {
        quoteSchema.parse({ recipient: tooLong, sender: validSender });
        expect.fail("Should have thrown validation error");
      } catch (error) {
        const apiError = normalizeApiError(error);
        expect(apiError.status).toBe(422);
        expect(apiError.code).toBe("validation_error");
      }
    });
  });
});
