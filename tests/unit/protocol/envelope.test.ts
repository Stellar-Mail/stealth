import { describe, expect, it } from "vitest";
import { validateEnvelope, canonicalize } from "../../../src/server/api/envelope";
import vectors from "../../../protocol/vectors/vectors.json";

describe("protocol/envelope", () => {
  // Check that the envelope test vectors are loaded
  const envelopeVectors = (vectors as any).categories?.envelope;
  if (!envelopeVectors) {
    throw new Error("Envelope test vectors not found in vectors.json");
  }

  for (const c of envelopeVectors.cases) {
    it(c.id, () => {
      if (c.expected.valid) {
        // 1. Validate the envelope successfully parses
        const parsed = validateEnvelope(c.input);
        expect(parsed).toBeDefined();

        // 2. Validate canonical JCS serialization matches exactly
        const canonical = canonicalize(c.input.payload);
        expect(canonical).toBe(c.expected.canonical);
      } else {
        // 3. Validate validation fails closed and throws
        expect(() => {
          validateEnvelope(c.input);
        }).toThrow();

        // Check if the expected error string matches/contains part of the thrown error
        try {
          validateEnvelope(c.input);
        } catch (err: any) {
          expect(err.message).toContain(c.expected.error);
        }
      }
    });
  }

  // Additional sanity tests for JCS canonicalization logic
  describe("canonicalize JCS details", () => {
    it("should sort keys lexicographically", () => {
      const obj = { z: 1, a: 2, m: { y: 3, b: 4 } };
      const canonical = canonicalize(obj);
      expect(canonical).toBe('{"a":2,"m":{"b":4,"y":3},"z":1}');
    });

    it("should handle null and primitives correctly", () => {
      expect(canonicalize(null)).toBe("null");
      expect(canonicalize(true)).toBe("true");
      expect(canonicalize(false)).toBe("false");
      expect(canonicalize(123.45)).toBe("123.45");
      expect(canonicalize("hello")).toBe('"hello"');
    });

    it("should handle empty arrays and nested arrays", () => {
      const arr = [1, "two", [3, null]];
      expect(canonicalize(arr)).toBe('[1,"two",[3,null]]');
    });

    it("should reject unsupported types like function/undefined", () => {
      expect(() => canonicalize(undefined)).toThrow();
      expect(() => canonicalize(() => {})).toThrow();
    });
  });
});
