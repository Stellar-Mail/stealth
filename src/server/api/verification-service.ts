import type { VerificationToken } from "./domain";
import { ApiError } from "./errors";
import type { ApiContext } from "./context";
import { recordAuditEvent } from "./audit";
import type { DeliveryReceipt, VerificationEmailMessage } from "@/services/notifications/adapter";
import type { ApiRepository } from "./repository";

/**
 * BETA-005: Verification-token lifecycle.
 *
 * Implements the full vertical slice for account verification:
 *
 * 1. Issuing hashed, single-use, expiring tokens (with replacement semantics:
 *    a resend invalidates the previous token atomically).
 * 2. Verification with replay safety, expiry, and brute-force attempt caps.
 * 3. Resend with cooldown enforcement.
 *
 * Security invariants:
 * - The plaintext token is generated here, handed to the delivery adapter,
 *   and NEVER persisted, logged, or returned in an API response. Only the
 *   SHA-256 hash is stored (see `verificationTokenSchema`).
 * - All transitions (issue/consume/attempt) run through the repository's
 *   atomic, per-key exclusive operations, so concurrent requests observe a
 *   single winner.
 * - Audit events reference the token *hash* (a safe, correlatable reference),
 *   never the plaintext token.
 */

export interface VerificationPolicy {
  tokenLifetimeMs: number;
  resendCooldownMs: number;
  maxAttempts: number;
}

export const DEFAULT_VERIFICATION_POLICY: VerificationPolicy = {
  tokenLifetimeMs: 24 * 60 * 60 * 1000,
  resendCooldownMs: 60 * 1000,
  maxAttempts: 5,
};

export const VERIFICATION_PURPOSE = "email_verification" as const;

/** Token size: 32 random bytes -> 43 base64url characters (~256 bits). */
export const VERIFICATION_TOKEN_BYTES = 32;

export type VerifyFailureReason =
  "invalid_token" | "expired" | "reused" | "replaced" | "brute_force_blocked" | "activation_failed";

export type VerifyOutcome =
  | { outcome: "verified"; userId: string }
  | { outcome: "failed"; reason: VerifyFailureReason; userId?: string };

export type ResendOutcome =
  | {
      outcome: "sent";
      userId: string;
      retryAfterSeconds: number;
      expiresAt: Date;
    }
  /** Generic no-op: no pending account (or already verified) — nothing leaked. */
  | { outcome: "noop" }
  | { outcome: "cooldown"; userId: string; retryAfterSeconds: number }
  | { outcome: "delivery_failed"; userId: string; retryAfterSeconds: number };

export interface IssuedVerificationToken {
  plaintextToken: string;
  tokenHash: string;
  expiresAt: Date;
  replaced: boolean;
}

function requestIdOf(context: ApiContext): string {
  return context.requestId ?? "unknown";
}

/**
 * Generate a cryptographically secure random verification token.
 * 256 bits of entropy via `crypto.getRandomValues`; there is no Math.random
 * fallback — an unsupported environment fails explicitly.
 */
export function generateVerificationToken(): string {
  if (typeof crypto === "undefined" || typeof crypto.getRandomValues !== "function") {
    throw new ApiError(
      500,
      "internal_error",
      "Cryptographically secure random source is unavailable",
    );
  }
  const bytes = new Uint8Array(VERIFICATION_TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** SHA-256 of the plaintext token, lowercase hex — the only persisted form. */
export async function hashVerificationToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  let out = "";
  for (const byte of new Uint8Array(digest)) {
    out += byte.toString(16).padStart(2, "0");
  }
  return out;
}

/**
 * Issue a new verification token for a user, atomically invalidating the
 * previous still-redeemable token for the same (user, purpose).
 */
export async function issueEmailVerificationToken(
  context: ApiContext,
  userId: string,
  policy: VerificationPolicy = DEFAULT_VERIFICATION_POLICY,
  now: Date = new Date(),
): Promise<IssuedVerificationToken> {
  const plaintextToken = generateVerificationToken();
  const tokenHash = await hashVerificationToken(plaintextToken);

  const token: VerificationToken = {
    tokenHash,
    userId,
    purpose: VERIFICATION_PURPOSE,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + policy.tokenLifetimeMs).toISOString(),
    consumedAt: null,
    replacedAt: null,
    replacedByTokenHash: null,
    attemptCount: 0,
    maxAttempts: policy.maxAttempts,
  };

  const result = await context.repository.issueVerificationToken(token, now);
  if (result.outcome === "conflict") {
    // 256-bit collision — fails closed rather than overwriting a stored record.
    throw new ApiError(500, "internal_error", "Verification token generation collided");
  }

  return {
    plaintextToken,
    tokenHash,
    expiresAt: new Date(token.expiresAt),
    replaced: result.replacedToken !== null,
  };
}

/**
 * Verify a candidate token for the given account email.
 *
 * Repeat-safe: replaying a token that already verified an account that is now
 * `active` reports success rather than an error, so retries and double-clicks
 * are safe. Every other failure path is recorded as a brute-force attempt.
 */
export async function verifyEmailVerificationToken(
  context: ApiContext,
  email: string,
  candidateToken: string,
  now: Date = new Date(),
): Promise<VerifyOutcome> {
  const repository = context.repository;
  const user = await repository.getUserByEmail(email);
  const tokenHash = await hashVerificationToken(candidateToken);

  const result = await repository.consumeVerificationToken(tokenHash, now);

  if (result.outcome === "not-found") {
    recordAuditEvent({
      actor: email,
      action: "auth.verification_failed",
      targetType: "verification_token",
      safeTargetReference: tokenHash,
      result: "denied",
      requestId: requestIdOf(context),
    });
    return { outcome: "failed", reason: "invalid_token" };
  }

  const tokenUserId = result.token.userId;
  const belongsToEmail = user !== null && user.userId === tokenUserId;

  if (result.outcome === "consumed") {
    if (!belongsToEmail) {
      recordAuditEvent({
        actor: email,
        action: "auth.verification_failed",
        targetType: "verification_token",
        safeTargetReference: tokenHash,
        result: "denied",
        requestId: requestIdOf(context),
      });
      return {
        outcome: "failed",
        reason: "invalid_token",
        userId: tokenUserId,
      };
    }
    const activated = await activateUserIfPending(repository, tokenUserId, now);
    if (!activated) {
      recordAuditEvent({
        actor: tokenUserId,
        action: "auth.verification_activation_failed",
        targetType: "verification_token",
        safeTargetReference: tokenHash,
        result: "denied",
        requestId: requestIdOf(context),
      });
      return {
        outcome: "failed",
        reason: "activation_failed",
        userId: tokenUserId,
      };
    }
    recordAuditEvent({
      actor: tokenUserId,
      action: "auth.verification_succeeded",
      targetType: "verification_token",
      safeTargetReference: tokenHash,
      result: "success",
      requestId: requestIdOf(context),
    });
    return { outcome: "verified", userId: tokenUserId };
  }

  // Terminal outcomes: expired / reused / replaced / brute-force blocked.
  // A replay of an already-verified token against an active account is safe
  // to acknowledge as success (no state change occurs).
  if (result.outcome === "already-consumed" && belongsToEmail && user.status === "active") {
    recordAuditEvent({
      actor: tokenUserId,
      action: "auth.verification_replayed",
      targetType: "verification_token",
      safeTargetReference: tokenHash,
      result: "success",
      requestId: requestIdOf(context),
    });
    return { outcome: "verified", userId: tokenUserId };
  }

  await repository.recordVerificationAttempt(tokenHash, now);

  const reason: VerifyFailureReason =
    result.outcome === "expired"
      ? "expired"
      : result.outcome === "replaced"
        ? "replaced"
        : result.outcome === "brute-force-blocked"
          ? "brute_force_blocked"
          : "reused";

  recordAuditEvent({
    actor: tokenUserId,
    action: `auth.verification_failed.${reason}`,
    targetType: "verification_token",
    safeTargetReference: tokenHash,
    result: "denied",
    requestId: requestIdOf(context),
  });
  return { outcome: "failed", reason, userId: tokenUserId };
}

/**
 * Resend a verification message, enforcing the resend cooldown.
 *
 * Generic-response contract: unknown emails and accounts that are not pending
 * verification return `noop` without issuing a token or revealing anything.
 */
export async function resendEmailVerificationToken(
  context: ApiContext,
  email: string,
  policy: VerificationPolicy,
  deliver: (message: VerificationEmailMessage) => Promise<DeliveryReceipt>,
  appUrl: string,
  now: Date = new Date(),
): Promise<ResendOutcome> {
  const repository = context.repository;
  const user = await repository.getUserByEmail(email);

  if (!user || user.status !== "pending_verification") {
    return { outcome: "noop" };
  }

  const active = await repository.getActiveVerificationToken(user.userId, VERIFICATION_PURPOSE);
  if (active && active.consumedAt === null && active.replacedAt === null) {
    const elapsedMs = now.getTime() - Date.parse(active.createdAt);
    const remainingMs = policy.resendCooldownMs - elapsedMs;
    if (remainingMs > 0) {
      return {
        outcome: "cooldown",
        userId: user.userId,
        retryAfterSeconds: Math.ceil(remainingMs / 1000),
      };
    }
  }

  const issued = await issueEmailVerificationToken(context, user.userId, policy, now);
  const verificationUrl = buildVerificationUrl(appUrl, email, issued.plaintextToken);

  const message: VerificationEmailMessage = {
    to: user.email,
    purpose: VERIFICATION_PURPOSE,
    verificationUrl,
    expiresAt: issued.expiresAt,
  };

  let receipt: DeliveryReceipt;
  try {
    receipt = await deliver(message);
  } catch (error) {
    recordAuditEvent({
      actor: user.userId,
      action: "auth.verification_delivery_failed",
      targetType: "verification_token",
      safeTargetReference: issued.tokenHash,
      result: "denied",
      requestId: requestIdOf(context),
    });
    throw error;
  }

  if (!receipt.accepted) {
    recordAuditEvent({
      actor: user.userId,
      action: "auth.verification_delivery_failed",
      targetType: "verification_token",
      safeTargetReference: issued.tokenHash,
      result: "denied",
      requestId: requestIdOf(context),
    });
    return {
      outcome: "delivery_failed",
      userId: user.userId,
      retryAfterSeconds: Math.ceil(policy.resendCooldownMs / 1000),
    };
  }

  recordAuditEvent({
    actor: user.userId,
    action: "auth.verification_token_issued",
    targetType: "verification_token",
    safeTargetReference: issued.tokenHash,
    result: "success",
    requestId: requestIdOf(context),
  });

  return {
    outcome: "sent",
    userId: user.userId,
    retryAfterSeconds: Math.ceil(policy.resendCooldownMs / 1000),
    expiresAt: issued.expiresAt,
  };
}

/** Builds the clickable verification link carrying the plaintext token. */
export function buildVerificationUrl(
  appUrl: string,
  email: string,
  plaintextToken: string,
): string {
  const base = appUrl.endsWith("/") ? appUrl.slice(0, -1) : appUrl;
  const params = new URLSearchParams({
    email,
    token: plaintextToken,
  });
  return `${base}/verify?${params.toString()}`;
}

async function activateUserIfPending(
  repository: ApiRepository,
  userId: string,
  now: Date,
): Promise<boolean> {
  const user = await repository.getUserById(userId);
  if (!user) return false;
  if (user.status === "active") return true;
  if (user.status !== "pending_verification") return false;

  const first = await repository.updateUser({ ...user, status: "active" }, user.version);
  if (first.updated) return true;

  // Optimistic concurrency conflict: refresh and retry once.
  const fresh = await repository.getUserById(userId);
  if (!fresh) return false;
  if (fresh.status === "active") return true;
  if (fresh.status !== "pending_verification") return false;
  const retry = await repository.updateUser({ ...fresh, status: "active" }, fresh.version);
  return retry.updated;
}
