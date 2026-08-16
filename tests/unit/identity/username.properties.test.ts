import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  USERNAME_FORMAT_REGEX,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  normalizeUsername,
  usernameSchema,
} from "../../../src/features/identity/username";

const NUM_RUNS = 200;

const asciiUsernameCharArbitrary = fc.constantFrom(
  ..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-".split(""),
);

describe("normalizeUsername (property)", () => {
  it("is idempotent for arbitrary strings", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 64 }), (raw) => {
        const once = normalizeUsername(raw);
        expect(normalizeUsername(once)).toBe(once);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("never grows a plain-ASCII-charset input (no confusables, no invisibles to fold or strip)", () => {
    fc.assert(
      fc.property(
        fc.array(asciiUsernameCharArbitrary, { minLength: 1, maxLength: 40 }),
        (chars) => {
          const raw = chars.join("");
          expect(normalizeUsername(raw)).toBe(raw.toLowerCase());
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("is case-insensitive: normalizing a string and its uppercase form yields the same canonical value", () => {
    fc.assert(
      fc.property(
        fc.array(asciiUsernameCharArbitrary, { minLength: 1, maxLength: 40 }),
        (chars) => {
          const raw = chars.join("");
          expect(normalizeUsername(raw.toUpperCase())).toBe(normalizeUsername(raw.toLowerCase()));
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

const canonicalUsernameArbitrary = fc
  .array(asciiUsernameCharArbitrary, {
    minLength: USERNAME_MIN_LENGTH,
    maxLength: USERNAME_MAX_LENGTH,
  })
  .map((chars) => chars.join("").toLowerCase())
  .filter((value) => USERNAME_FORMAT_REGEX.test(value));

describe("usernameSchema (property)", () => {
  it("every value it accepts satisfies the canonical length and charset invariants", () => {
    fc.assert(
      fc.property(canonicalUsernameArbitrary, (candidate) => {
        const result = usernameSchema.safeParse(candidate);
        // Some generated candidates collide with the reserved-word list; that
        // is a valid, expected rejection, not a property violation.
        if (!result.success) return;

        expect(result.data.length).toBeGreaterThanOrEqual(USERNAME_MIN_LENGTH);
        expect(result.data.length).toBeLessThanOrEqual(USERNAME_MAX_LENGTH);
        expect(USERNAME_FORMAT_REGEX.test(result.data)).toBe(true);
        expect(result.data).toBe(result.data.toLowerCase());
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("parsing is idempotent: re-parsing an already-canonical value returns it unchanged", () => {
    fc.assert(
      fc.property(canonicalUsernameArbitrary, (candidate) => {
        const first = usernameSchema.safeParse(candidate);
        if (!first.success) return;
        const second = usernameSchema.safeParse(first.data);
        expect(second.success).toBe(true);
        if (second.success) {
          expect(second.data).toBe(first.data);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
