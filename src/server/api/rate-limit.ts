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

  const { max, windowSeconds } = RATE_LIMITS[type];
  const cost = RATE_LIMIT_OPERATION_COSTS[operation];
  const count = await repository.incrementCounter(`abuse:${type}:${subject}`, windowSeconds, cost);

  if (count > max) {
    return { allowed: false, retryAfterSeconds: windowSeconds };
  }
  return { allowed: true };
}
