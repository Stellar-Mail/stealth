import { describe, it, expect, beforeEach } from "vitest";
import {
  constantTimeCompare,
  TokenBucketRateLimiter,
  validateEmailDomainSafety,
  validateHoneypotFields,
} from "../../../src/server/api/verification-security-hardening";

describe("BETA-005: Verification Security Hardening", () => {
  describe("constantTimeCompare", () => {
    it("returns true for identical strings", () => {
      const a = "a4c28f1190bcdae741";
      const b = "a4c28f1190bcdae741";
      expect(constantTimeCompare(a, b)).toBe(true);
    });

    it("returns false for strings of different content or length", () => {
      expect(constantTimeCompare("token123", "token124")).toBe(false);
      expect(constantTimeCompare("token123", "token1234")).toBe(false);
      expect(constantTimeCompare("", "abc")).toBe(false);
    });
  });

  describe("TokenBucketRateLimiter", () => {
    let limiter: TokenBucketRateLimiter;

    beforeEach(() => {
      limiter = new TokenBucketRateLimiter({
        capacity: 3,
        refillRatePerSecond: 1, // 1 token per second
      });
    });

    it("allows requests within capacity and blocks bursts", () => {
      const ip = "192.168.1.100";
      expect(limiter.tryConsume(ip, 1).allowed).toBe(true);
      expect(limiter.tryConsume(ip, 1).allowed).toBe(true);
      expect(limiter.tryConsume(ip, 1).allowed).toBe(true);

      // 4th request exceeds capacity
      const burst = limiter.tryConsume(ip, 1);
      expect(burst.allowed).toBe(false);
      expect(burst.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    });

    it("refills tokens over time", async () => {
      const ip = "10.0.0.1";
      limiter.tryConsume(ip, 3);
      expect(limiter.tryConsume(ip, 1).allowed).toBe(false);

      await new Promise((r) => setTimeout(r, 1100)); // wait > 1s for refill

      expect(limiter.tryConsume(ip, 1).allowed).toBe(true);
    });
  });

  describe("validateEmailDomainSafety", () => {
    it("accepts valid standard email domains", () => {
      expect(validateEmailDomainSafety("alice@proton.me").valid).toBe(true);
      expect(validateEmailDomainSafety("bob@gmail.com").valid).toBe(true);
      expect(validateEmailDomainSafety("corp@stealth.mail").valid).toBe(true);
    });

    it("rejects known throwaway disposable domains", () => {
      expect(validateEmailDomainSafety("spammer@mailinator.com").valid).toBe(false);
      expect(validateEmailDomainSafety("temp@10minutemail.com").valid).toBe(false);
      expect(validateEmailDomainSafety("anon@guerrillamail.com").valid).toBe(false);
    });

    it("rejects malformed domains", () => {
      expect(validateEmailDomainSafety("invalid_email").valid).toBe(false);
      expect(validateEmailDomainSafety("missing@domain").valid).toBe(false);
    });
  });

  describe("validateHoneypotFields", () => {
    it("passes when honeypot field is missing or empty", () => {
      expect(() => validateHoneypotFields({})).not.toThrow();
      expect(() => validateHoneypotFields({ website: "" })).not.toThrow();
    });

    it("throws ApiError when honeypot field is filled by bot", () => {
      expect(() => validateHoneypotFields({ website: "http://bot-spam.com" })).toThrow();
    });
  });
});
