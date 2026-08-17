import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { MAX_CORRELATION_ID_LENGTH, validateCorrelationId } from "../../../src/server/api/response";

const NUM_RUNS = 150;

const TOKEN_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._~-".split("");

const validTokenArbitrary: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(...TOKEN_CHARS), { minLength: 1, maxLength: MAX_CORRELATION_ID_LENGTH })
  .map((chars) => chars.join(""));

describe("validateCorrelationId (property)", () => {
  it("accepts every generated token within the length bound verbatim", () => {
    fc.assert(
      fc.property(validTokenArbitrary, (token) => {
        expect(validateCorrelationId(token)).toBe(token);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("trims surrounding whitespace before validating", () => {
    fc.assert(
      fc.property(
        validTokenArbitrary,
        fc.constantFrom("", " ", "\t", "  ", "\n "),
        (token, padding) => {
          expect(validateCorrelationId(`${padding}${token}${padding}`)).toBe(token);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("rejects tokens exactly one character past the maximum length, and accepts exactly at it", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...TOKEN_CHARS), {
          minLength: MAX_CORRELATION_ID_LENGTH,
          maxLength: MAX_CORRELATION_ID_LENGTH,
        }),
        fc.constantFrom(...TOKEN_CHARS),
        (chars, extra) => {
          const atBoundary = chars.join("");
          const overBoundary = atBoundary + extra;
          expect(validateCorrelationId(atBoundary)).toBe(atBoundary);
          expect(validateCorrelationId(overBoundary)).toBeUndefined();
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("rejects any token containing a disallowed character", () => {
    const badChars = [",", "/", "@", "\\", "é"];

    fc.assert(
      fc.property(
        validTokenArbitrary,
        fc.nat(),
        fc.constantFrom(...badChars),
        (token, seed, badChar) => {
          const index = seed % (token.length + 1);
          const withBadChar = token.slice(0, index) + badChar + token.slice(index);
          expect(validateCorrelationId(withBadChar)).toBeUndefined();
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("rejects null, undefined, empty, and whitespace-only values", () => {
    expect(validateCorrelationId(null)).toBeUndefined();
    expect(validateCorrelationId(undefined)).toBeUndefined();
    expect(validateCorrelationId("")).toBeUndefined();

    const whitespaceArbitrary = fc
      .array(fc.constantFrom(" ", "\t", "\n"), { minLength: 1, maxLength: 20 })
      .map((chars) => chars.join(""));

    fc.assert(
      fc.property(whitespaceArbitrary, (ws) => {
        expect(validateCorrelationId(ws)).toBeUndefined();
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
