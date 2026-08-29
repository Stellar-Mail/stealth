import { ApiError } from "./errors";

/**
 * BETA-005 / BETA-085: Verification Security Hardening Engine.
 *
 * Implements security defenses against authentication attacks:
 * 1. Constant-time string / hash comparison to prevent timing-attack side-channels.
 * 2. Token Bucket rate limiters for IP addresses and recipient emails.
 * 3. Disposable / throwaway domain detector.
 * 4. Honeypot field and bot signature validator.
 *
 * Security Invariants:
 * - Constant-time comparison always checks the full digest length regardless of mismatch position.
 * - Rate limiting state never leaks sensitive token or user account data.
 */

/**
 * Performs a constant-time equality comparison between two strings to eliminate
 * timing side-channels during token or signature validation.
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }

  const lengthA = a.length;
  const lengthB = b.length;
  let result = lengthA ^ lengthB;

  for (let i = 0; i < lengthA; i++) {
    const charCodeB = i < lengthB ? b.charCodeAt(i) : 0;
    result |= a.charCodeAt(i) ^ charCodeB;
  }

  return result === 0;
}

export interface RateLimiterOptions {
  readonly capacity: number;
  readonly refillRatePerSecond: number;
}

export class TokenBucketRateLimiter {
  private readonly buckets = new Map<string, { tokens: number; lastRefillTime: number }>();
  private readonly capacity: number;
  private readonly refillRatePerSecond: number;

  constructor(options: RateLimiterOptions) {
    this.capacity = options.capacity;
    this.refillRatePerSecond = options.refillRatePerSecond;
  }

  /**
   * Attempts to consume one or more tokens for a given identifier (IP or user ID).
   * Returns true if allowed, false if rate limited.
   */
  tryConsume(
    key: string,
    tokensToConsume = 1,
  ): { allowed: boolean; remainingTokens: number; retryAfterSeconds: number } {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = { tokens: this.capacity, lastRefillTime: now };
      this.buckets.set(key, bucket);
    } else {
      const elapsedSeconds = (now - bucket.lastRefillTime) / 1000;
      const refilledTokens = elapsedSeconds * this.refillRatePerSecond;
      bucket.tokens = Math.min(this.capacity, bucket.tokens + refilledTokens);
      bucket.lastRefillTime = now;
    }

    if (bucket.tokens >= tokensToConsume) {
      bucket.tokens -= tokensToConsume;
      return {
        allowed: true,
        remainingTokens: Math.floor(bucket.tokens),
        retryAfterSeconds: 0,
      };
    }

    const deficit = tokensToConsume - bucket.tokens;
    const retryAfter = Math.ceil(deficit / this.refillRatePerSecond);

    return {
      allowed: false,
      remainingTokens: 0,
      retryAfterSeconds: Math.max(1, retryAfter),
    };
  }

  reset(key?: string): void {
    if (key) {
      this.buckets.delete(key);
    } else {
      this.buckets.clear();
    }
  }

  get activeKeyCount(): number {
    return this.buckets.size;
  }
}

/**
 * Disposable / temporary email domain blocklist.
 */
const KNOWN_DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "10minutemail.com",
  "tempmail.com",
  "guerrillamail.com",
  "sharklasers.com",
  "trashmail.com",
  "throwawaymail.com",
  "yopmail.com",
  "dispostable.com",
]);

/**
 * Validates email domain legitimacy and blocks known disposable providers.
 */
export function validateEmailDomainSafety(email: string): { valid: boolean; reason?: string } {
  if (!email || !email.includes("@")) {
    return { valid: false, reason: "Malformed email address" };
  }

  const parts = email.toLowerCase().trim().split("@");
  if (parts.length !== 2) {
    return { valid: false, reason: "Malformed email domain structure" };
  }

  const domain = parts[1];
  if (KNOWN_DISPOSABLE_DOMAINS.has(domain)) {
    return {
      valid: false,
      reason: `Disposable email domains (${domain}) are prohibited for beta registration`,
    };
  }

  // Domain structure checks
  if (!domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) {
    return { valid: false, reason: "Invalid domain extension" };
  }

  return { valid: true };
}

/**
 * Validates honeypot bot trap parameters during registration / verification resend.
 */
export function validateHoneypotFields(
  payload: Record<string, unknown>,
  honeypotKey = "website",
): void {
  if (payload && typeof payload === "object" && honeypotKey in payload) {
    const val = payload[honeypotKey];
    if (typeof val === "string" && val.trim().length > 0) {
      throw new ApiError(400, "bad_request", "Automated submission rejected");
    }
  }
}

// Global default rate limiters
export const ipVerificationRateLimiter = new TokenBucketRateLimiter({
  capacity: 20,
  refillRatePerSecond: 0.5, // 1 token every 2 seconds
});

export const recipientResendRateLimiter = new TokenBucketRateLimiter({
  capacity: 3,
  refillRatePerSecond: 1 / 60, // 1 token per 60 seconds
});
