import { describe, expect, it } from "vitest";

import {
  RESERVED_USERNAMES,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  isReservedUsername,
  normalizeUsername,
  usernameSchema,
  validateUsernameCandidate,
} from "../../../src/features/identity/username";

// Built from explicit code points (not literal glyphs) so the exact
// characters under test are unambiguous and immune to transcription errors.
const CYRILLIC_A = String.fromCodePoint(0x0430); // CYRILLIC SMALL LETTER A, looks like "a"
const CYRILLIC_E = String.fromCodePoint(0x0435); // CYRILLIC SMALL LETTER IE, looks like "e"
const CYRILLIC_O = String.fromCodePoint(0x043e); // CYRILLIC SMALL LETTER O, looks like "o"
const CYRILLIC_P = String.fromCodePoint(0x0440); // CYRILLIC SMALL LETTER ER, looks like "p"
const GREEK_ALPHA = String.fromCodePoint(0x03b1); // GREEK SMALL LETTER ALPHA, looks like "a"
const GREEK_OMICRON = String.fromCodePoint(0x03bf); // GREEK SMALL LETTER OMICRON, looks like "o"
const FULLWIDTH_ALICE = [0xff41, 0xff4c, 0xff49, 0xff43, 0xff45]
  .map((codePoint) => String.fromCodePoint(codePoint))
  .join(""); // fullwidth "alice", folds to ASCII via NFKC
const ZERO_WIDTH_SPACE = String.fromCodePoint(0x200b);
const SOFT_HYPHEN = String.fromCodePoint(0x00ad);
const BOM = String.fromCodePoint(0xfeff);

describe("normalizeUsername", () => {
  it("lowercases and trims", () => {
    expect(normalizeUsername("  Alice  ")).toBe("alice");
    expect(normalizeUsername("ALICE")).toBe("alice");
  });

  it("folds fullwidth Unicode compatibility variants via NFKC", () => {
    expect(normalizeUsername(FULLWIDTH_ALICE)).toBe("alice");
  });

  it("strips invisible/zero-width characters", () => {
    expect(normalizeUsername(`ad${ZERO_WIDTH_SPACE}min`)).toBe("admin");
    expect(normalizeUsername(`ad${SOFT_HYPHEN}min`)).toBe("admin");
    expect(normalizeUsername(`${BOM}alice`)).toBe("alice");
  });

  it("folds known Cyrillic confusables to their Latin lookalike", () => {
    expect(normalizeUsername(`${CYRILLIC_A}dmin`)).toBe("admin");
    expect(normalizeUsername(`r${CYRILLIC_O}${CYRILLIC_O}t`)).toBe("root");
    expect(normalizeUsername(`${CYRILLIC_P}${CYRILLIC_A}${CYRILLIC_O}${CYRILLIC_E}`)).toBe("paoe");
  });

  it("folds known Greek confusables to their Latin lookalike", () => {
    expect(normalizeUsername(`${GREEK_ALPHA}dmin`)).toBe("admin");
    expect(normalizeUsername(`ro${GREEK_OMICRON}t`)).toBe("root");
  });

  it("is idempotent", () => {
    const once = normalizeUsername(`  Alice${ZERO_WIDTH_SPACE} `);
    expect(normalizeUsername(once)).toBe(once);
  });
});

describe("isReservedUsername", () => {
  it("flags known reserved words", () => {
    expect(isReservedUsername("admin")).toBe(true);
    expect(isReservedUsername("support")).toBe(true);
    expect(isReservedUsername("stealth")).toBe(true);
  });

  it("does not flag an ordinary handle", () => {
    expect(isReservedUsername("alice")).toBe(false);
  });

  it("every reserved word is already lowercase canonical form", () => {
    for (const word of RESERVED_USERNAMES) {
      expect(word).toBe(word.toLowerCase());
    }
  });
});

describe("usernameSchema", () => {
  it("accepts a well-formed handle and returns its canonical form", () => {
    expect(usernameSchema.parse("Alice")).toBe("alice");
    expect(usernameSchema.parse("alice-99")).toBe("alice-99");
    expect(usernameSchema.parse("alice_99")).toBe("alice_99");
  });

  it("rejects a candidate shorter than the minimum length", () => {
    expect(() => usernameSchema.parse("a".repeat(USERNAME_MIN_LENGTH - 1))).toThrow();
  });

  it("accepts exactly the minimum length boundary", () => {
    expect(usernameSchema.parse("a".repeat(USERNAME_MIN_LENGTH))).toBe(
      "a".repeat(USERNAME_MIN_LENGTH),
    );
  });

  it("accepts exactly the maximum length boundary", () => {
    expect(usernameSchema.parse("a".repeat(USERNAME_MAX_LENGTH))).toBe(
      "a".repeat(USERNAME_MAX_LENGTH),
    );
  });

  it("rejects a candidate longer than the maximum length", () => {
    expect(() => usernameSchema.parse("a".repeat(USERNAME_MAX_LENGTH + 1))).toThrow();
  });

  it("rejects characters outside the allowed charset", () => {
    expect(() => usernameSchema.parse("alice smith")).toThrow();
    expect(() => usernameSchema.parse("alice@wallet")).toThrow();
    expect(() => usernameSchema.parse("alice.smith")).toThrow();
    expect(() => usernameSchema.parse("alice/smith")).toThrow();
  });

  it("rejects a leading or trailing separator", () => {
    expect(() => usernameSchema.parse("-alice")).toThrow();
    expect(() => usernameSchema.parse("alice-")).toThrow();
    expect(() => usernameSchema.parse("_alice")).toThrow();
    expect(() => usernameSchema.parse("alice_")).toThrow();
  });

  it("rejects a reserved word regardless of case", () => {
    expect(() => usernameSchema.parse("admin")).toThrow();
    expect(() => usernameSchema.parse("Admin")).toThrow();
    expect(() => usernameSchema.parse("ADMIN")).toThrow();
  });

  it("rejects a confusable variant of a reserved word", () => {
    expect(() => usernameSchema.parse(`${CYRILLIC_A}dmin`)).toThrow();
  });

  it("rejects raw input beyond the hard input cap before normalization runs", () => {
    expect(() => usernameSchema.parse("a".repeat(129))).toThrow();
  });

  it("rejects an empty or whitespace-only candidate", () => {
    expect(() => usernameSchema.parse("")).toThrow();
    expect(() => usernameSchema.parse("   ")).toThrow();
  });
});

describe("validateUsernameCandidate", () => {
  it("returns a canonical value for valid input without throwing", () => {
    const result = validateUsernameCandidate("Alice");
    expect(result).toEqual({ valid: true, canonical: "alice" });
  });

  it("returns structured issues for invalid input", () => {
    const result = validateUsernameCandidate("ab");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues.length).toBeGreaterThan(0);
    }
  });
});

describe("case and Unicode variants collapse to one canonical identity", () => {
  it("normalizes every variant of the same handle to an identical canonical form", () => {
    const variants = ["alice", "Alice", "ALICE", "AlIcE", " alice ", FULLWIDTH_ALICE];
    const canonicalForms = new Set(variants.map((variant) => normalizeUsername(variant)));
    expect(canonicalForms.size).toBe(1);
    expect([...canonicalForms][0]).toBe("alice");
  });
});
