import { describe, expect, it } from "vitest";

import {
  hasConfusableCharacters,
  isReservedUsername,
  normalizeUsername,
  toStealthEmail,
  toStellarFederation,
  validateUsername,
} from "@/features/identity/username";

describe("Canonical Username Validation & Normalization (BETA-003)", () => {
  describe("Normalization & Case Folding", () => {
    it("converts uppercase and mixed-case to lowercase", () => {
      expect(normalizeUsername("AliceSmith")).toBe("alicesmith");
      expect(normalizeUsername("  BOB_MARLEY  ")).toBe("bob_marley");
    });

    it("applies Unicode NFKC normalization and strips zero-width spaces", () => {
      expect(normalizeUsername("A\u200Blice")).toBe("alice");
      expect(normalizeUsername("ＦｕｌｌＷｉｄｔｈ")).toBe("fullwidth");
    });
  });

  describe("Confusable & Homoglyph Detection", () => {
    it("flags Cyrillic and Greek homoglyphs disguised as Latin", () => {
      // Cyrillic 'а' (\u0430) vs Latin 'a'
      expect(hasConfusableCharacters("аlice")).toBe(true);
      // Greek 'α' (\u03b1)
      expect(hasConfusableCharacters("αlice")).toBe(true);
    });

    it("flags zero-width characters and invisible spaces", () => {
      expect(hasConfusableCharacters("usr\u200B123")).toBe(true);
      expect(hasConfusableCharacters("usr\uFEFF123")).toBe(true);
    });

    it("allows standard ASCII alphanumeric, hyphens, and underscores", () => {
      expect(hasConfusableCharacters("alice_smith-99")).toBe(false);
    });
  });

  describe("Reserved Word Enforcement", () => {
    it("detects system reserved usernames regardless of casing", () => {
      expect(isReservedUsername("admin")).toBe(true);
      expect(isReservedUsername("ADMIN")).toBe(true);
      expect(isReservedUsername("support")).toBe(true);
      expect(isReservedUsername("stealth")).toBe(true);
      expect(isReservedUsername("postmaster")).toBe(true);
      expect(isReservedUsername("null")).toBe(true);
      expect(isReservedUsername("undefined")).toBe(true);
    });

    it("allows non-reserved valid usernames", () => {
      expect(isReservedUsername("alice99")).toBe(false);
      expect(isReservedUsername("crypto_bob")).toBe(false);
    });
  });

  describe("Comprehensive Validation Rules", () => {
    it("validates valid usernames and produces canonical email and federation handles", () => {
      const res = validateUsername("Alice_99");
      expect(res.valid).toBe(true);
      expect(res.normalized).toBe("alice_99");
      expect(res.canonicalEmail).toBe("alice_99@stealth.me");
      expect(res.federationHandle).toBe("alice_99*stealth.me");
    });

    it("rejects usernames that are too short (<3) or too long (>32)", () => {
      const shortRes = validateUsername("ab");
      expect(shortRes.valid).toBe(false);
      expect(shortRes.reason).toBe("length");

      const longRes = validateUsername("a".repeat(33));
      expect(longRes.valid).toBe(false);
      expect(longRes.reason).toBe("length");
    });

    it("rejects usernames starting or ending with hyphens or underscores", () => {
      expect(validateUsername("-alice").valid).toBe(false);
      expect(validateUsername("alice_").valid).toBe(false);
    });

    it("rejects consecutive hyphens or underscores", () => {
      const res = validateUsername("alice--smith");
      expect(res.valid).toBe(false);
      expect(res.reason).toBe("consecutive_symbols");
    });

    it("rejects reserved usernames with reserved_word reason", () => {
      const res = validateUsername("security");
      expect(res.valid).toBe(false);
      expect(res.reason).toBe("reserved_word");
    });

    it("rejects homoglyph / confusable characters with confusable_characters reason", () => {
      const res = validateUsername("аdmin"); // Cyrillic 'а'
      expect(res.valid).toBe(false);
      expect(res.reason).toBe("confusable_characters");
    });
  });

  describe("Stealth Identity & Stellar Federation Formatters", () => {
    it("formats Stealth email address as user@domain", () => {
      expect(toStealthEmail("Alice")).toBe("alice@stealth.me");
      expect(toStealthEmail("bob", "stealth.xyz")).toBe("bob@stealth.xyz");
    });

    it("formats Stellar federation handle as user*domain", () => {
      expect(toStellarFederation("Alice")).toBe("alice*stealth.me");
      expect(toStellarFederation("bob", "stealth.xyz")).toBe("bob*stealth.xyz");
    });
  });
});
