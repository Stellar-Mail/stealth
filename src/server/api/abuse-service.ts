import { createHash } from "node:crypto";

import type { ApiRepository } from "./repository";
import * as metrics from "./metrics";

function rateLimited(retryAfterSeconds: number) {
  return { allowed: false, retryAfterSeconds };
}

export type AbuseRoute =
  | "postage_submit"
  | "auth_login"
  | "auth_register"
  | "relay_submit"
  | "storage_stage"
  | "storage_finalize"
  | "chain_write";

export type AbuseCheck =
  | "account"
  | "device"
  | "ip"
  | "proof_failure"
  | "relay"
  | "sender_recipient"
  | "session"
  | "storage_bytes"
  | "chain_write";

export type AbuseOutagePolicy = "fail_closed" | "fail_open";

export type AbuseDecision = {
  allowed: boolean;
  flagged?: boolean;
  outage?: {
    check: AbuseCheck;
    policy: AbuseOutagePolicy;
    route: AbuseRoute;
  };
  retryAfterSeconds?: number;
};

export const ABUSE_OUTAGE_POLICIES: Record<AbuseRoute, Record<AbuseCheck, AbuseOutagePolicy>> = {
  postage_submit: {
    account: "fail_closed",
    device: "fail_open",
    ip: "fail_open",
    proof_failure: "fail_closed",
    relay: "fail_open",
    sender_recipient: "fail_closed",
    session: "fail_open",
    storage_bytes: "fail_open",
    chain_write: "fail_open",
  },
  auth_login: {
    account: "fail_closed",
    device: "fail_open",
    ip: "fail_open",
    proof_failure: "fail_closed",
    relay: "fail_open",
    sender_recipient: "fail_open",
    session: "fail_closed",
    storage_bytes: "fail_open",
    chain_write: "fail_open",
  },
  auth_register: {
    account: "fail_closed",
    device: "fail_open",
    ip: "fail_closed",
    proof_failure: "fail_open",
    relay: "fail_open",
    sender_recipient: "fail_open",
    session: "fail_open",
    storage_bytes: "fail_open",
    chain_write: "fail_open",
  },
  relay_submit: {
    account: "fail_open",
    device: "fail_open",
    ip: "fail_open",
    proof_failure: "fail_open",
    relay: "fail_closed",
    sender_recipient: "fail_closed",
    session: "fail_open",
    storage_bytes: "fail_open",
    chain_write: "fail_open",
  },
  storage_stage: {
    account: "fail_closed",
    device: "fail_open",
    ip: "fail_open",
    proof_failure: "fail_open",
    relay: "fail_open",
    sender_recipient: "fail_open",
    session: "fail_open",
    storage_bytes: "fail_closed",
    chain_write: "fail_open",
  },
  storage_finalize: {
    account: "fail_closed",
    device: "fail_open",
    ip: "fail_open",
    proof_failure: "fail_open",
    relay: "fail_open",
    sender_recipient: "fail_open",
    session: "fail_open",
    storage_bytes: "fail_closed",
    chain_write: "fail_open",
  },
  chain_write: {
    account: "fail_closed",
    device: "fail_open",
    ip: "fail_open",
    proof_failure: "fail_open",
    relay: "fail_open",
    sender_recipient: "fail_open",
    session: "fail_open",
    storage_bytes: "fail_open",
    chain_write: "fail_closed",
  },
};

const OUTAGE_RETRY_AFTER_SECONDS = 60;

function sanitizeError(error: unknown) {
  return error instanceof Error ? error.name || "Error" : "unknown";
}

function observeAbuseFallback(
  route: AbuseRoute,
  check: AbuseCheck,
  policy: AbuseOutagePolicy,
  error: unknown,
) {
  const decision = policy === "fail_closed" ? "deny" : "allow";
  const fields = {
    check,
    decision,
    errorType: sanitizeError(error),
    policy,
    route,
  };

  metrics.incrementCounter("abuse_dependency_fallback", fields);
  metrics.recordAuditEvent("abuse.dependency_fallback", fields);
}

async function withOutagePolicy(
  route: AbuseRoute,
  check: AbuseCheck,
  operation: () => Promise<AbuseDecision>,
): Promise<AbuseDecision> {
  try {
    return await operation();
  } catch (error) {
    const policy = ABUSE_OUTAGE_POLICIES[route][check];
    observeAbuseFallback(route, check, policy, error);

    if (policy === "fail_open") {
      return {
        allowed: true,
        flagged: true,
        outage: { check, policy, route },
      };
    }

    return {
      allowed: false,
      outage: { check, policy, route },
      retryAfterSeconds: OUTAGE_RETRY_AFTER_SECONDS,
    };
  }
}

async function checkIncrementedLimit(
  repository: ApiRepository,
  key: string,
  max: number,
  windowSeconds: number,
): Promise<AbuseDecision> {
  const count = await repository.incrementCounter(key, windowSeconds);
  if (count > max) return rateLimited(windowSeconds);
  return { allowed: true };
}

async function checkStoredLimit(
  repository: ApiRepository,
  key: string,
  max: number,
  retryAfterSeconds: number,
): Promise<AbuseDecision> {
  const count = await repository.getCounter(key);
  if (count >= max) return rateLimited(retryAfterSeconds);
  return { allowed: true };
}

function normalizeFingerprintField(value?: string) {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}

export function buildDeviceFingerprint(headers: {
  userAgent?: string;
  acceptLanguage?: string;
  acceptEncoding?: string;
  ipPrefix?: string;
}): string {
  const payload = [
    normalizeFingerprintField(headers.userAgent),
    normalizeFingerprintField(headers.acceptLanguage),
    normalizeFingerprintField(headers.acceptEncoding),
    normalizeFingerprintField(headers.ipPrefix),
  ].join("|");

  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

/**
 * Normalize an IP address to prevent evasion via alternate spellings:
 * - IPv4-mapped IPv6 addresses (::ffff:1.2.3.4) are reduced to the IPv4 form.
 * - Addresses are lowercased and trimmed.
 * - Unknown/empty values are returned as-is so callers can apply fail-open logic.
 */
export function normalizeIp(ip: string): string {
  if (!ip || ip === "unknown") return ip;
  const trimmed = ip.trim().toLowerCase();
  // IPv4-mapped IPv6: ::ffff:a.b.c.d
  const mapped = trimmed.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) return mapped[1];
  return trimmed;
}

export async function checkAccountLimit(
  repository: ApiRepository,
  sender: string,
  route: AbuseRoute = "postage_submit",
): Promise<AbuseDecision> {
  return withOutagePolicy(route, "account", () =>
    checkIncrementedLimit(repository, `abuse:account:${sender}`, 50, 3600),
  );
}

export async function checkIpLimit(
  repository: ApiRepository,
  ip: string,
  route: AbuseRoute = "postage_submit",
): Promise<AbuseDecision> {
  const normalized = normalizeIp(ip);
  if (normalized === "" || normalized === "unknown") {
    return { allowed: true, flagged: true };
  }

  return withOutagePolicy(route, "ip", () =>
    checkIncrementedLimit(repository, `abuse:ip:${normalized}`, 100, 3600),
  );
}

export async function checkSenderRecipientLimit(
  repository: ApiRepository,
  sender: string,
  recipient: string,
  route: AbuseRoute = "postage_submit",
): Promise<AbuseDecision> {
  return withOutagePolicy(route, "sender_recipient", () =>
    checkIncrementedLimit(repository, `abuse:pair:${sender}:${recipient}`, 10, 3600),
  );
}

export async function checkProofFailureLimit(
  repository: ApiRepository,
  sender: string,
  route: AbuseRoute = "postage_submit",
): Promise<AbuseDecision> {
  return withOutagePolicy(route, "proof_failure", () =>
    checkStoredLimit(repository, `abuse:proof:${sender}`, 5, 900),
  );
}

export async function recordProofFailure(repository: ApiRepository, sender: string): Promise<void> {
  await repository.incrementCounter(`abuse:proof:${sender}`, 900);
}

export async function checkRelayLimit(
  repository: ApiRepository,
  relayId: string,
  route: AbuseRoute = "postage_submit",
): Promise<AbuseDecision> {
  return withOutagePolicy(route, "relay", () =>
    checkIncrementedLimit(repository, `abuse:relay:${relayId}`, 500, 3600),
  );
}

export async function checkDeviceLimit(
  repository: ApiRepository,
  fingerprint: string,
  opts?: { route?: AbuseRoute; windowMs?: number; max?: number },
): Promise<AbuseDecision> {
  const windowMs = opts?.windowMs ?? 60_000;
  const max = opts?.max ?? 30;
  return withOutagePolicy(opts?.route ?? "postage_submit", "device", async () => {
    const count = await repository.incrementCounter(`device:${fingerprint}`, windowMs / 1000);
    if (count > max) return { allowed: false, retryAfterSeconds: windowMs / 1000 };
    return { allowed: true };
  });
}

// ─── New budgets: auth, relay, storage, chain-write ─────────────────────────

/** Per-IP budget for authentication attempts (login + register combined). */
export const AUTH_IP_BUDGET = Object.freeze({
  login: { max: 20, windowSeconds: 900 },
  register: { max: 10, windowSeconds: 3600 },
} as const);

/** Per-session budget for relay submissions in a rolling window. */
export const RELAY_SESSION_BUDGET = Object.freeze({
  max: 200,
  windowSeconds: 3600,
} as const);

/** Per-account storage byte budget (staged bytes, 100 MiB per hour). */
export const STORAGE_BYTE_BUDGET = Object.freeze({
  maxBytes: 100 * 1024 * 1024, // 100 MiB
  windowSeconds: 3600,
} as const);

/** Per-account chain-write budget (on-chain transactions per hour). */
export const CHAIN_WRITE_BUDGET = Object.freeze({
  max: 20,
  windowSeconds: 3600,
} as const);

/**
 * Check per-IP rate limit for login attempts.
 * Applied before expensive password verification so brute-force is throttled early.
 */
export async function checkAuthIpLoginLimit(
  repository: ApiRepository,
  ip: string,
): Promise<AbuseDecision> {
  const normalized = normalizeIp(ip);
  if (normalized === "" || normalized === "unknown") {
    return { allowed: true, flagged: true };
  }
  return withOutagePolicy("auth_login", "ip", () =>
    checkIncrementedLimit(
      repository,
      `abuse:auth_login:ip:${normalized}`,
      AUTH_IP_BUDGET.login.max,
      AUTH_IP_BUDGET.login.windowSeconds,
    ),
  );
}

/**
 * Check per-IP rate limit for registration attempts.
 * Applied before account creation to prevent mass-registration abuse.
 */
export async function checkAuthIpRegisterLimit(
  repository: ApiRepository,
  ip: string,
): Promise<AbuseDecision> {
  const normalized = normalizeIp(ip);
  if (normalized === "" || normalized === "unknown") {
    return { allowed: true, flagged: true };
  }
  return withOutagePolicy("auth_register", "ip", () =>
    checkIncrementedLimit(
      repository,
      `abuse:auth_register:ip:${normalized}`,
      AUTH_IP_BUDGET.register.max,
      AUTH_IP_BUDGET.register.windowSeconds,
    ),
  );
}

/**
 * Check per-session relay submission quota.
 * Applied before the relay service accepts a message envelope so sessions cannot
 * spam the delivery queue.
 */
export async function checkRelaySessionLimit(
  repository: ApiRepository,
  sessionId: string,
): Promise<AbuseDecision> {
  return withOutagePolicy("relay_submit", "session", () =>
    checkIncrementedLimit(
      repository,
      `abuse:relay:session:${sessionId}`,
      RELAY_SESSION_BUDGET.max,
      RELAY_SESSION_BUDGET.windowSeconds,
    ),
  );
}

/**
 * Check per-account storage byte budget before staging an object.
 * Applied before writing to R2 so abusive upload patterns are stopped before
 * any object-store cost is incurred.
 *
 * @param byteCount - Number of bytes in the object about to be staged.
 * @param route - The route context for outage policy selection.
 * @param maxBytesOverride - Optional override for the byte budget (used in tests with small values).
 */
export async function checkStorageByteBudget(
  repository: ApiRepository,
  ownerAddress: string,
  byteCount: number,
  route: AbuseRoute = "storage_stage",
  maxBytesOverride?: number,
): Promise<AbuseDecision> {
  const maxBytes = maxBytesOverride ?? STORAGE_BYTE_BUDGET.maxBytes;
  return withOutagePolicy(route, "storage_bytes", async () => {
    const currentBytes = await repository.getCounter(`abuse:storage:bytes:${ownerAddress}`);
    if (currentBytes + byteCount > maxBytes) {
      return rateLimited(STORAGE_BYTE_BUDGET.windowSeconds);
    }
    return { allowed: true };
  });
}

/**
 * Record bytes staged for an account (called after a successful stage).
 */
export async function recordStorageBytes(
  repository: ApiRepository,
  ownerAddress: string,
  byteCount: number,
): Promise<void> {
  await repository.incrementCounter(
    `abuse:storage:bytes:${ownerAddress}`,
    STORAGE_BYTE_BUDGET.windowSeconds,
    byteCount,
  );
}

/**
 * Check per-account chain-write budget before submitting an on-chain transaction.
 * Applied before any Soroban RPC or Horizon submission so abusive chain traffic is
 * stopped before network cost is incurred.
 */
export async function checkChainWriteLimit(
  repository: ApiRepository,
  accountAddress: string,
): Promise<AbuseDecision> {
  return withOutagePolicy("chain_write", "chain_write", () =>
    checkIncrementedLimit(
      repository,
      `abuse:chain_write:${accountAddress}`,
      CHAIN_WRITE_BUDGET.max,
      CHAIN_WRITE_BUDGET.windowSeconds,
    ),
  );
}
