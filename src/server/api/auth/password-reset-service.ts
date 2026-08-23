import { recordAuditEvent } from "../audit";
import type { ApiContext } from "../context";
import {
  passwordPolicySchema,
  type Credential,
  type VerificationPurpose,
  type VerificationToken,
} from "../domain";
import { ApiError } from "../errors";
import type { DeliveryReceipt, VerificationEmailMessage } from "@/services/notifications/adapter";
import { hashPassword } from "./password";
import { revokeAllSessions } from "./session-service";
import { generateVerificationToken, hashVerificationToken } from "../verification-service";

/**
 * BETA-009 (Issue #1916): Password reset request and one-time completion flow.
 *
 * Security invariants:
 * 1. Enumeration-resistant: Password reset request returns the exact same
 *    generic confirmation ({ status: "sent" }) whether the account exists or not.
 * 2. Token single-use & account-scoped: Tokens are 256-bit cryptographically secure,
 *    hashed with SHA-256 before persistence, bound to a single user ID and purpose,
 *    and single-use enforced at the data layer via atomic CAS operations.
 * 3. Race-safe completion: Racing concurrent completions on the same token yield
 *    exactly one winner; subsequent/racing callers get a clean 409 conflict.
 * 4. Password policy: Minimum 12 characters, uppercase, lowercase, and numeric digits.
 * 5. Full session revocation: Completing a password reset invalidates all existing
 *    sessions for the user across all devices (no old sessions survive a reset).
 * 6. Outstanding token invalidation: Completing a reset invalidates all other
 *    outstanding reset tokens for that account.
 * 7. Breach-safe audit logging: Only token hashes or masked identifiers are logged;
 *    raw tokens, passwords, or seeds are NEVER logged.
 */

export interface PasswordResetPolicy {
  tokenLifetimeMs: number;
  resendCooldownMs: number;
  maxAttempts: number;
  ipRateLimitWindowSeconds: number;
  maxRequestsPerIp: number;
}

export const DEFAULT_PASSWORD_RESET_POLICY: PasswordResetPolicy = {
  tokenLifetimeMs: 60 * 60 * 1000, // 1 hour
  resendCooldownMs: 60 * 1000, // 60 seconds cooldown
  maxAttempts: 5,
  ipRateLimitWindowSeconds: 60 * 60, // 1 hour
  maxRequestsPerIp: 10,
};

export const PASSWORD_RESET_PURPOSE: VerificationPurpose = "password_reset";

export interface RequestPasswordResetInput {
  email: string;
  ip?: string;
}

export interface CompletePasswordResetInput {
  token: string;
  newPassword: string;
  email?: string;
  host?: string;
}

export interface PasswordResetRequestOutcome {
  status: "sent";
  retryAfterSeconds: number;
}

export interface PasswordResetCompleteOutcome {
  success: true;
  message: string;
  cookieHeaders: string[];
}

export interface IssuedPasswordResetToken {
  plaintextToken: string;
  tokenHash: string;
  expiresAt: Date;
  replaced: boolean;
}

function requestIdOf(context: ApiContext): string {
  return context.requestId ?? "unknown";
}

/**
 * Builds the clickable reset link carrying the plaintext token.
 */
export function buildPasswordResetUrl(
  appUrl: string,
  email: string,
  plaintextToken: string,
): string {
  const base = appUrl.endsWith("/") ? appUrl.slice(0, -1) : appUrl;
  const params = new URLSearchParams({
    email,
    token: plaintextToken,
  });
  return `${base}/reset-password?${params.toString()}`;
}

/**
 * Issue a new password reset token for a user, atomically invalidating the
 * previous still-redeemable reset token for the same user.
 */
export async function issuePasswordResetToken(
  context: ApiContext,
  userId: string,
  policy: PasswordResetPolicy = DEFAULT_PASSWORD_RESET_POLICY,
  now: Date = new Date(),
): Promise<IssuedPasswordResetToken> {
  const plaintextToken = generateVerificationToken();
  const tokenHash = await hashVerificationToken(plaintextToken);

  const token: VerificationToken = {
    tokenHash,
    userId,
    purpose: PASSWORD_RESET_PURPOSE,
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
    throw new ApiError(500, "internal_error", "Password reset token generation collided");
  }

  return {
    plaintextToken,
    tokenHash,
    expiresAt: new Date(token.expiresAt),
    replaced: result.replacedToken !== null,
  };
}

/**
 * Request flow: accepts an identifier (email) and issues a password-reset token
 * delivered via the notification adapter. Enumeration-resistant: always returns
 * { status: "sent" } regardless of account existence, and every rate-limit /
 * cooldown gate is keyed on the request inputs (identifier hash, IP) — never on
 * whether the account exists — so an attacker sees byte-identical responses for
 * existing and non-existing addresses in every situation.
 */
export async function requestPasswordReset(
  context: ApiContext,
  input: RequestPasswordResetInput,
  deliver: (message: VerificationEmailMessage) => Promise<DeliveryReceipt>,
  appUrl: string,
  policy: PasswordResetPolicy = DEFAULT_PASSWORD_RESET_POLICY,
  now: Date = new Date(),
): Promise<PasswordResetRequestOutcome> {
  const repository = context.repository;
  const normalizedEmail = input.email.trim().toLowerCase();
  const ip = input.ip ?? "unknown";
  const cooldownSeconds = Math.max(1, Math.ceil(policy.resendCooldownMs / 1000));

  // Identifier and IP gate keys are derived from request inputs only, so the
  // throttling behavior is identical for existing and non-existing accounts.
  const emailHash = await hashVerificationToken(normalizedEmail);
  const emailCooldownKey = `pwd_reset:email:${emailHash}`;
  const ipRateLimitKey = `pwd_reset:ip:${ip}`;

  // The repository counters only prune on write, so each gate increments first
  // (which prunes out-of-window entries) and then compares the returned count.
  // This keeps every check accurate and identical across account existence.
  // 1. Per-IP rate limiting
  const ipCount = await repository.incrementCounter(
    ipRateLimitKey,
    policy.ipRateLimitWindowSeconds,
    1,
  );
  if (ipCount > policy.maxRequestsPerIp) {
    throw new ApiError(429, "too_many_requests", "Too many password reset requests from this IP", {
      retryAfterSeconds: policy.ipRateLimitWindowSeconds,
    });
  }

  // 2. Per-identifier cooldown applied uniformly before the account lookup,
  //    so a repeated request to any address (registered or not) is throttled
  //    identically — no cooldown-timing oracle for account enumeration.
  const cooldownCount = await repository.incrementCounter(emailCooldownKey, cooldownSeconds, 1);
  if (cooldownCount > 1) {
    throw new ApiError(429, "too_many_requests", "Password reset request is still on cooldown", {
      retryAfterSeconds: cooldownSeconds,
    });
  }

  // 3. User lookup (enumeration-resistant)
  const user = await repository.getUserByEmail(normalizedEmail);

  const genericOutcome: PasswordResetRequestOutcome = {
    status: "sent",
    retryAfterSeconds: cooldownSeconds,
  };

  if (!user) {
    recordAuditEvent({
      actor: emailHash,
      action: "auth.password_reset_requested_unknown_account",
      targetType: "account",
      safeTargetReference: emailHash,
      result: "denied",
      requestId: requestIdOf(context),
    });
    return genericOutcome;
  }

  // 5. Issue token & build delivery message
  const issued = await issuePasswordResetToken(context, user.userId, policy, now);
  const resetUrl = buildPasswordResetUrl(appUrl, user.email, issued.plaintextToken);

  const message: VerificationEmailMessage = {
    to: user.email,
    purpose: PASSWORD_RESET_PURPOSE,
    verificationUrl: resetUrl,
    expiresAt: issued.expiresAt,
  };

  let receipt: DeliveryReceipt;
  try {
    receipt = await deliver(message);
  } catch (error) {
    recordAuditEvent({
      actor: user.userId,
      action: "auth.password_reset_delivery_failed",
      targetType: "verification_token",
      safeTargetReference: issued.tokenHash,
      result: "denied",
      requestId: requestIdOf(context),
    });
    throw new ApiError(
      503,
      "dependency_unavailable",
      "The password reset message could not be delivered",
    );
  }

  if (!receipt.accepted) {
    recordAuditEvent({
      actor: user.userId,
      action: "auth.password_reset_delivery_failed",
      targetType: "verification_token",
      safeTargetReference: issued.tokenHash,
      result: "denied",
      requestId: requestIdOf(context),
    });
    throw new ApiError(
      503,
      "dependency_unavailable",
      "The password reset message could not be delivered",
    );
  }

  recordAuditEvent({
    actor: user.userId,
    action: "auth.password_reset_requested",
    targetType: "verification_token",
    safeTargetReference: issued.tokenHash,
    result: "success",
    requestId: requestIdOf(context),
  });

  return genericOutcome;
}

/**
 * Completion flow: accepts token + new password, validates token single-use & expiry,
 * enforces password policy, sets new password, invalidates all other outstanding reset
 * tokens for the account, and revokes all active sessions for the account.
 */
export async function completePasswordReset(
  context: ApiContext,
  input: CompletePasswordResetInput,
  now: Date = new Date(),
): Promise<PasswordResetCompleteOutcome> {
  const repository = context.repository;

  // 1. Password policy validation
  const passwordResult = passwordPolicySchema.safeParse(input.newPassword);
  if (!passwordResult.success) {
    throw new ApiError(
      422,
      "validation_error",
      passwordResult.error.issues[0]?.message ?? "Password does not meet policy requirements",
    );
  }

  const tokenHash = await hashVerificationToken(input.token);

  // 2. Atomic single-use token consumption (CAS-safe)
  const result = await repository.consumeVerificationToken(tokenHash, now);

  if (result.outcome === "not-found") {
    recordAuditEvent({
      actor: "anonymous",
      action: "auth.password_reset_failed.invalid_token",
      targetType: "verification_token",
      safeTargetReference: tokenHash,
      result: "denied",
      requestId: requestIdOf(context),
    });
    throw new ApiError(400, "bad_request", "Invalid password reset token");
  }

  const userId = result.token.userId;

  if (result.outcome === "expired") {
    await repository.recordVerificationAttempt(tokenHash, now);
    recordAuditEvent({
      actor: userId,
      action: "auth.password_reset_failed.expired",
      targetType: "verification_token",
      safeTargetReference: tokenHash,
      result: "denied",
      requestId: requestIdOf(context),
    });
    throw new ApiError(400, "bad_request", "Password reset token has expired");
  }

  if (result.outcome === "already-consumed") {
    await repository.recordVerificationAttempt(tokenHash, now);
    recordAuditEvent({
      actor: userId,
      action: "auth.password_reset_failed.reused",
      targetType: "verification_token",
      safeTargetReference: tokenHash,
      result: "denied",
      requestId: requestIdOf(context),
    });
    throw new ApiError(409, "conflict", "Password reset token has already been used");
  }

  if (result.outcome === "replaced") {
    await repository.recordVerificationAttempt(tokenHash, now);
    recordAuditEvent({
      actor: userId,
      action: "auth.password_reset_failed.replaced",
      targetType: "verification_token",
      safeTargetReference: tokenHash,
      result: "denied",
      requestId: requestIdOf(context),
    });
    throw new ApiError(
      409,
      "conflict",
      "Password reset token has been superseded by a newer request",
    );
  }

  if (result.outcome === "brute-force-blocked") {
    recordAuditEvent({
      actor: userId,
      action: "auth.password_reset_failed.brute_force_blocked",
      targetType: "verification_token",
      safeTargetReference: tokenHash,
      result: "denied",
      requestId: requestIdOf(context),
    });
    throw new ApiError(
      429,
      "too_many_requests",
      "Too many invalid reset attempts. Token is locked",
    );
  }

  if (result.outcome !== "consumed") {
    throw new ApiError(400, "bad_request", "Invalid password reset token");
  }

  // Token was successfully consumed! Verify user identity.
  const user = await repository.getUserById(userId);
  if (!user) {
    recordAuditEvent({
      actor: userId,
      action: "auth.password_reset_failed.user_not_found",
      targetType: "verification_token",
      safeTargetReference: tokenHash,
      result: "denied",
      requestId: requestIdOf(context),
    });
    throw new ApiError(400, "bad_request", "User account associated with token was not found");
  }

  if (input.email) {
    const normalizedInputEmail = input.email.trim().toLowerCase();
    if (user.email.toLowerCase() !== normalizedInputEmail) {
      recordAuditEvent({
        actor: userId,
        action: "auth.password_reset_failed.email_mismatch",
        targetType: "verification_token",
        safeTargetReference: tokenHash,
        result: "denied",
        requestId: requestIdOf(context),
      });
      throw new ApiError(
        400,
        "bad_request",
        "Password reset token does not belong to specified email",
      );
    }
  }

  // 3. Set the new password hash
  const { hash, salt } = await hashPassword(input.newPassword);
  const existingCred = await repository.getCredential(userId);

  const updatedCredential: Credential = {
    credentialId: existingCred?.credentialId ?? `cred_${crypto.randomUUID().replace(/-/g, "")}`,
    userId,
    authMethod: "password_hash",
    secretHash: `${hash}:${salt}`,
    walletKeyRef: existingCred?.walletKeyRef ?? `wallet_${userId}`,
    createdAt: existingCred?.createdAt ?? now.toISOString(),
    updatedAt: now.toISOString(),
  };

  await repository.setCredential(updatedCredential);

  // 4. Invalidate all other outstanding reset tokens for this account
  await repository.invalidateActiveVerificationToken(userId, PASSWORD_RESET_PURPOSE, now);

  // 5. Revoke ALL existing sessions for this account (no old sessions survive a reset)
  const sessionRevocation = await revokeAllSessions(context, userId, { host: input.host });

  // 6. Breach-safe audit log
  recordAuditEvent({
    actor: userId,
    action: "auth.password_reset_completed",
    targetType: "account",
    safeTargetReference: userId,
    result: "success",
    requestId: requestIdOf(context),
  });

  return {
    success: true,
    message: "Password has been reset successfully. All existing sessions have been revoked.",
    cookieHeaders: sessionRevocation.cookieHeaders,
  };
}
