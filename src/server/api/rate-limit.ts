/**
 * Distributed rate limiter with two isolation planes:
 *
 *   - Authenticated: keyed by verified principal (Stellar address or
 *     opaque actor ID). Each principal has its own independent bucket
 *     so a single high-volume caller cannot starve others.
 *
 *   - Anonymous: keyed by a privacy-preserving network key derived
 *     from the raw network address via a one-way HMAC. The raw address
 *     is never stored; only the fixed-length digest is persisted, and
 *     only for the duration of the sliding window.
 *
 * Both paths return retry guidance in the result and throw ApiError
 * 429 with a retryAfterSeconds detail when the limit is exceeded.
 *
 * Counter storage is delegated to ApiRepository.incrementCounter which
 * uses a sliding window keyed by the opaque bucket string.
 */

import { createHmac } from "node:crypto";

import { ApiError } from "./errors";
import type { ApiRepository } from "./repository";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Limits and windows for authenticated principals. */
export const AUTHENTICATED_LIMIT = {
  /** Maximum requests per window. */
  max: 120,
  /** Sliding window duration in seconds. */
  windowSeconds: 60,
} as const;

/** Limits and windows for anonymous (unauthenticated) callers. */
export const ANONYMOUS_LIMIT = {
  max: 20,
  windowSeconds: 60,
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds the caller should wait before retrying. Present when allowed=false. */
  retryAfterSeconds?: number;
  /** The opaque bucket key used for this check. Useful for testing. */
  bucketKey: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Derives a fixed-length, privacy-preserving bucket key from a raw
 * network address. Uses HMAC-SHA256 with a per-process secret so the
 * digest cannot be reversed to recover the original address.
 *
 * The secret is intentionally ephemeral (process lifetime) — anonymous
 * digests rotate on restart, which is acceptable because the window is
 * short (60 s) and the goal is load-shedding rather than long-term tracking.
 */
const ANON_SECRET = (() => {
  // Use crypto.getRandomValues if available (Workers runtime), else fall
  // back to a random hex string via Math.random (only used in tests).
  try {
    const buf = new Uint8Array(32);
    crypto.getRandomValues(buf);
    return Buffer.from(buf).toString("hex");
  } catch {
    return Math.random().toString(36).repeat(4);
  }
})();

function deriveAnonKey(networkAddress: string): string {
  return createHmac("sha256", ANON_SECRET).update(networkAddress).digest("hex").slice(0, 32);
}

async function checkLimit(
  repository: ApiRepository,
  bucketKey: string,
  max: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const count = await repository.incrementCounter(bucketKey, windowSeconds);
  if (count > max) {
    return { allowed: false, retryAfterSeconds: windowSeconds, bucketKey };
  }
  return { allowed: true, bucketKey };
}

function throwIfDenied(result: RateLimitResult, context: string): void {
  if (!result.allowed) {
    throw new ApiError(429, "too_many_requests", `Rate limit exceeded: ${context}`, {
      retryAfterSeconds: result.retryAfterSeconds,
    });
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check the rate limit for a verified principal (authenticated caller).
 *
 * The principal is a stable, verified identifier — typically a Stellar
 * G-address or an opaque actor ID returned by the auth layer. Each
 * principal has its own isolated sliding-window bucket.
 *
 * Throws ApiError(429) when the limit is exceeded.
 */
export async function checkAuthenticatedLimit(
  repository: ApiRepository,
  principal: string,
  opts?: { max?: number; windowSeconds?: number },
): Promise<RateLimitResult> {
  const max = opts?.max ?? AUTHENTICATED_LIMIT.max;
  const windowSeconds = opts?.windowSeconds ?? AUTHENTICATED_LIMIT.windowSeconds;
  const bucketKey = `rl:auth:${principal}`;

  const result = await checkLimit(repository, bucketKey, max, windowSeconds);
  throwIfDenied(result, "authenticated");
  return result;
}

/**
 * Check the rate limit for an anonymous (unauthenticated) caller.
 *
 * The raw network address is hashed via HMAC before being used as a
 * bucket key. Only the digest is passed to the repository; the raw
 * address is never stored. If the network address is absent or
 * unknown, all anonymous callers share a single fallback bucket which
 * has a tighter limit to prevent trivial bypass.
 *
 * Throws ApiError(429) when the limit is exceeded.
 */
export async function checkAnonymousLimit(
  repository: ApiRepository,
  networkAddress: string | undefined,
  opts?: { max?: number; windowSeconds?: number },
): Promise<RateLimitResult> {
  const max = opts?.max ?? ANONYMOUS_LIMIT.max;
  const windowSeconds = opts?.windowSeconds ?? ANONYMOUS_LIMIT.windowSeconds;

  const hasAddress = networkAddress && networkAddress !== "unknown" && networkAddress !== "";
  const bucketKey = hasAddress
    ? `rl:anon:${deriveAnonKey(networkAddress)}`
    : "rl:anon:fallback";

  // Tighten limit for the shared fallback bucket so callers without a
  // network address cannot trivially exceed anonymous quotas.
  const effectiveMax = hasAddress ? max : Math.floor(max / 2);

  const result = await checkLimit(repository, bucketKey, effectiveMax, windowSeconds);
  throwIfDenied(result, "anonymous");
  return result;
}

/**
 * Unified dispatcher: applies the appropriate limiter based on whether
 * a verified principal is present.
 *
 * Use this at route middleware boundaries where the caller may be
 * authenticated or anonymous depending on the endpoint.
 *
 * Throws ApiError(429) when the applicable limit is exceeded.
 */
export async function applyRateLimit(
  repository: ApiRepository,
  context: {
    /** Verified principal (actor ID / Stellar address). Absent for anonymous callers. */
    principal?: string;
    /** Raw network address of the caller. Used only to derive an anonymous key. */
    networkAddress?: string;
  },
  opts?: { max?: number; windowSeconds?: number },
): Promise<RateLimitResult> {
  if (context.principal) {
    return checkAuthenticatedLimit(repository, context.principal, opts);
  }
  return checkAnonymousLimit(repository, context.networkAddress, opts);
}
