/**
 * BETA-049 — Central abuse-control wrappers.
 *
 * Each exported function applies the relevant budget checks (IP, account,
 * device, relay, storage, chain-write) *before* any expensive crypto, object-
 * store, or RPC work begins. Routes call these wrappers at the top of their
 * handler so no path can bypass an abuse policy.
 *
 * Operator overrides
 * ------------------
 * Set STEALTH_ABUSE_BYPASS_TOKEN to a secret token. Requests that supply
 * `x-stealth-operator-token: <token>` skip abuse checks (operator use only).
 * The token is never logged.
 *
 * Retry-After
 * -----------
 * Every rejection carries a `Retry-After` header value via ApiError.details so
 * the HTTP response layer can surface it to clients.
 */
import {
  checkAuthIpLoginLimit,
  checkAuthIpRegisterLimit,
  checkChainWriteLimit,
  checkDeviceLimit,
  checkIpLimit,
  checkRelaySessionLimit,
  checkStorageByteBudget,
  type AbuseDecision,
  type AbuseRoute,
} from "./abuse-service";
import { ApiError, type ApiErrorCode } from "./errors";
import type { ApiRepository } from "./repository";
import * as metrics from "./metrics";

// ─── Operator bypass ─────────────────────────────────────────────────────────

/**
 * Returns true when the request carries a valid operator override token,
 * allowing it to bypass abuse checks without modifying budgets.
 */
export function hasOperatorOverride(request: Request): boolean {
  const token = process.env.STEALTH_ABUSE_BYPASS_TOKEN;
  if (!token) return false;
  const supplied = request.headers.get("x-stealth-operator-token");
  // Constant-time comparison to avoid timing attacks
  if (!supplied || supplied.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) {
    diff |= token.charCodeAt(i) ^ supplied.charCodeAt(i);
  }
  return diff === 0;
}

// ─── Shared rejection helper ──────────────────────────────────────────────────

function rejectWithDecision(
  decision: AbuseDecision,
  metricName: string,
  metricLabels: Record<string, string>,
  limitMessage: string,
) {
  metrics.incrementCounter(metricName, metricLabels);

  if (decision.outage) {
    const code: ApiErrorCode = "dependency_unavailable";
    throw new ApiError(503, code, `Abuse ${decision.outage.check} check is unavailable`, {
      ...(decision.retryAfterSeconds !== undefined
        ? { retryAfterSeconds: decision.retryAfterSeconds }
        : {}),
      outagePolicy: decision.outage.policy,
      outageRoute: decision.outage.route,
    });
  }

  throw new ApiError(429, "too_many_requests", limitMessage, {
    ...(decision.retryAfterSeconds !== undefined
      ? { retryAfterSeconds: decision.retryAfterSeconds }
      : {}),
  });
}

// ─── Per-route wrappers ───────────────────────────────────────────────────────

/**
 * Apply IP-level rate limit for login attempts.
 * Call this before password verification so brute-force is stopped at the
 * network layer.
 */
export async function enforceAuthLoginLimits(
  repository: ApiRepository,
  ip: string,
  request?: Request,
): Promise<void> {
  if (request && hasOperatorOverride(request)) return;

  const ipDecision = await checkAuthIpLoginLimit(repository, ip);
  if (!ipDecision.allowed) {
    rejectWithDecision(
      ipDecision,
      "auth_limit_rejected",
      { limit: "ip", ip, route: "auth_login" },
      "Too many login attempts from this IP",
    );
  }
}

/**
 * Apply IP-level rate limit for registration attempts.
 * Call this before account creation to prevent mass-registration abuse.
 */
export async function enforceAuthRegisterLimits(
  repository: ApiRepository,
  ip: string,
  request?: Request,
): Promise<void> {
  if (request && hasOperatorOverride(request)) return;

  const ipDecision = await checkAuthIpRegisterLimit(repository, ip);
  if (!ipDecision.allowed) {
    rejectWithDecision(
      ipDecision,
      "auth_limit_rejected",
      { limit: "ip", ip, route: "auth_register" },
      "Too many registration attempts from this IP",
    );
  }
}

/**
 * Apply relay-specific abuse checks:
 *   1. Per-IP limit (shared with other routes, route-scoped counter).
 *   2. Per-session relay submission quota.
 *
 * @param sessionId - The authenticated session ID, or "anonymous" if none.
 */
export async function enforceRelaySubmitLimits(
  repository: ApiRepository,
  ip: string,
  sessionId: string,
  relayId: string,
  request?: Request,
): Promise<void> {
  if (request && hasOperatorOverride(request)) return;

  const ipDecision = await checkIpLimit(repository, ip, "relay_submit" as AbuseRoute);
  if (!ipDecision.allowed) {
    rejectWithDecision(
      ipDecision,
      "relay_limit_rejected",
      { limit: "ip", sessionId, relayId },
      "Relay IP limit exceeded",
    );
  }

  const sessionDecision = await checkRelaySessionLimit(repository, sessionId);
  if (!sessionDecision.allowed) {
    rejectWithDecision(
      sessionDecision,
      "relay_limit_rejected",
      { limit: "session", sessionId, relayId },
      "Relay session submission quota exceeded",
    );
  }
}

/**
 * Apply storage-staging abuse checks:
 *   1. Per-account storage byte budget for the rolling window.
 *
 * @param byteCount - Size of the object being staged in bytes.
 * @param maxBytesOverride - Optional budget override (for tests).
 */
export async function enforceStorageStageLimits(
  repository: ApiRepository,
  ownerAddress: string,
  byteCount: number,
  request?: Request,
  maxBytesOverride?: number,
): Promise<void> {
  if (request && hasOperatorOverride(request)) return;

  const storageDecision = await checkStorageByteBudget(
    repository,
    ownerAddress,
    byteCount,
    "storage_stage",
    maxBytesOverride,
  );
  if (!storageDecision.allowed) {
    rejectWithDecision(
      storageDecision,
      "storage_limit_rejected",
      { limit: "storage_bytes", ownerAddress, byteCount: String(byteCount) },
      "Storage byte budget exceeded",
    );
  }
}

/**
 * Apply storage-finalize abuse checks (same budget as staging — both consume
 * from the same per-account rolling window).
 *
 * @param maxBytesOverride - Optional budget override (for tests).
 */
export async function enforceStorageFinalizeLimits(
  repository: ApiRepository,
  ownerAddress: string,
  byteCount: number,
  request?: Request,
  maxBytesOverride?: number,
): Promise<void> {
  if (request && hasOperatorOverride(request)) return;

  const storageDecision = await checkStorageByteBudget(
    repository,
    ownerAddress,
    byteCount,
    "storage_finalize",
    maxBytesOverride,
  );
  if (!storageDecision.allowed) {
    rejectWithDecision(
      storageDecision,
      "storage_limit_rejected",
      { limit: "storage_bytes", ownerAddress, byteCount: String(byteCount) },
      "Storage byte budget exceeded during finalize",
    );
  }
}

/**
 * Apply per-account on-chain write budget before any Soroban RPC or Horizon
 * submission. This prevents one account from flooding the testnet.
 */
export async function enforceChainWriteLimits(
  repository: ApiRepository,
  accountAddress: string,
  request?: Request,
): Promise<void> {
  if (request && hasOperatorOverride(request)) return;

  const chainDecision = await checkChainWriteLimit(repository, accountAddress);
  if (!chainDecision.allowed) {
    rejectWithDecision(
      chainDecision,
      "chain_write_limit_rejected",
      { limit: "chain_write", accountAddress },
      "Chain write budget exceeded",
    );
  }
}

/**
 * Apply device-level limit alongside an IP check for additional signal.
 * Used where device fingerprinting is available (login, postage submit).
 */
export async function enforceDeviceLimit(
  repository: ApiRepository,
  fingerprint: string,
  opts?: { route?: AbuseRoute; windowMs?: number; max?: number },
  request?: Request,
): Promise<void> {
  if (request && hasOperatorOverride(request)) return;

  const deviceDecision = await checkDeviceLimit(repository, fingerprint, opts);
  if (!deviceDecision.allowed) {
    rejectWithDecision(
      deviceDecision,
      "auth_limit_rejected",
      { limit: "device", ip: "", route: opts?.route ?? "auth_login" },
      "Device rate limit exceeded",
    );
  }
}
