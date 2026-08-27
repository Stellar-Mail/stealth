import { createHash } from "node:crypto";

import type { ApiRepository } from "./repository";

export const RATE_LIMIT_OPERATION_COSTS = Object.freeze({
  read: 1,
  signatureVerification: 3,
  policyEvaluation: 5,
  paymentTransition: 10,
} as const);

export type RateLimitOperation = keyof typeof RATE_LIMIT_OPERATION_COSTS;
export type RateLimitType = "account" | "ip";

export type RateLimitConfig = {
  type: RateLimitType;
  operation: RateLimitOperation;
};

const RATE_LIMITS: Record<RateLimitType, { max: number; windowSeconds: number }> = {
  account: { max: 50, windowSeconds: 3600 },
  ip: { max: 100, windowSeconds: 3600 },
};

export function canonicalizeSubject(subject: string): string {
  const trimmed = subject.trim();
  if (trimmed.startsWith("G") || trimmed.startsWith("g")) {
    return trimmed.toUpperCase();
  }
  return trimmed;
}

export async function consumeRouteQuota(
  repository: ApiRepository,
  type: RateLimitType,
  subject: string,
  operation: RateLimitOperation,
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  // Preserve the IP limiter's existing fail-open behavior when the edge did
  // not provide an address; callers can separately flag this condition.
  if (type === "ip" && (subject === "" || subject === "unknown")) {
    return { allowed: true };
  }

  const normalizedSubject = type === "account" ? canonicalizeSubject(subject) : subject;
  const { max, windowSeconds } = RATE_LIMITS[type];
  const cost = RATE_LIMIT_OPERATION_COSTS[operation];
  const count = await repository.incrementCounter(
    `abuse:${type}:${normalizedSubject}`,
    windowSeconds,
    cost,
  );

  if (count > max) {
    return { allowed: false, retryAfterSeconds: windowSeconds };
  }
  return { allowed: true };
}

export const PROVISIONING_LIMITS = {
  account: { max: 3, windowSeconds: 3600 },
  origin: { max: 10, windowSeconds: 3600 },
} as const;

export type ProvisioningQuotaResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number; limitedBy: "account" | "origin" };

/**
 * BETA-018: per-account and per-origin caps on managed-wallet funding attempts.
 * Unknown origins fail open (same as the IP limiter) so edge-less local runs
 * still enforce the account quota.
 */
export async function consumeProvisioningQuota(
  repository: ApiRepository,
  subjects: { accountId: string; origin: string },
): Promise<ProvisioningQuotaResult> {
  const accountCount = await repository.incrementCounter(
    `abuse:provisioning:account:${subjects.accountId}`,
    PROVISIONING_LIMITS.account.windowSeconds,
  );
  if (accountCount > PROVISIONING_LIMITS.account.max) {
    return {
      allowed: false,
      retryAfterSeconds: PROVISIONING_LIMITS.account.windowSeconds,
      limitedBy: "account",
    };
  }

  const origin = subjects.origin.trim();
  if (origin !== "" && origin !== "unknown") {
    const originCount = await repository.incrementCounter(
      `abuse:provisioning:origin:${origin}`,
      PROVISIONING_LIMITS.origin.windowSeconds,
    );
    if (originCount > PROVISIONING_LIMITS.origin.max) {
      return {
        allowed: false,
        retryAfterSeconds: PROVISIONING_LIMITS.origin.windowSeconds,
        limitedBy: "origin",
      };
    }
  }

  return { allowed: true };
}

export const AUTH_FAILURE_LIMITS = {
  ipAndAccount: { max: 5, windowSeconds: 900 },
  ipWide: { max: 20, windowSeconds: 900 },
} as const;

function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function checkAuthFailureThrottle(
  repository: ApiRepository,
  ip: string,
  attemptedAddress: string,
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const ipVal = ip || "unknown";
  const ipHash = hashValue(ipVal);
  const canonicalAcct = canonicalizeSubject(attemptedAddress);
  const ipAcctHash = hashValue(`${ipVal}:${canonicalAcct}`);

  const ipAcctKey = `abuse:auth_fail:ip_acct:${ipAcctHash}`;
  const ipWideKey = `abuse:auth_fail:ip:${ipHash}`;

  const ipAcctCount = await repository.getCounter(ipAcctKey);
  if (ipAcctCount >= AUTH_FAILURE_LIMITS.ipAndAccount.max) {
    return {
      allowed: false,
      retryAfterSeconds: AUTH_FAILURE_LIMITS.ipAndAccount.windowSeconds,
    };
  }

  if (ipVal !== "unknown") {
    const ipWideCount = await repository.getCounter(ipWideKey);
    if (ipWideCount >= AUTH_FAILURE_LIMITS.ipWide.max) {
      return {
        allowed: false,
        retryAfterSeconds: AUTH_FAILURE_LIMITS.ipWide.windowSeconds,
      };
    }
  }

  return { allowed: true };
}

export async function recordAuthFailure(
  repository: ApiRepository,
  ip: string,
  attemptedAddress: string,
): Promise<{ delaySeconds: number }> {
  const ipVal = ip || "unknown";
  const ipHash = hashValue(ipVal);
  const canonicalAcct = canonicalizeSubject(attemptedAddress);
  const ipAcctHash = hashValue(`${ipVal}:${canonicalAcct}`);

  const ipAcctKey = `abuse:auth_fail:ip_acct:${ipAcctHash}`;
  const ipWideKey = `abuse:auth_fail:ip:${ipHash}`;

  const ipAcctCount = await repository.incrementCounter(
    ipAcctKey,
    AUTH_FAILURE_LIMITS.ipAndAccount.windowSeconds,
  );

  if (ipVal !== "unknown") {
    await repository.incrementCounter(ipWideKey, AUTH_FAILURE_LIMITS.ipWide.windowSeconds);
  }

  const delaySeconds = Math.min(60, Math.pow(2, ipAcctCount - 1));
  return { delaySeconds };
}
