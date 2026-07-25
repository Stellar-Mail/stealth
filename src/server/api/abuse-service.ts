import { createHash } from "node:crypto";

import type { ApiRepository } from "./repository";
import * as metrics from "./metrics";

function rateLimited(retryAfterSeconds: number) {
  return { allowed: false, retryAfterSeconds };
}

export type AbuseRoute = "postage_submit";
export type AbuseCheck =
  | "account"
  | "device"
  | "ip"
  | "proof_failure"
  | "relay"
  | "sender_recipient";
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
  if (ip === "" || ip === "unknown") {
    return { allowed: true, flagged: true };
  }

  return withOutagePolicy(route, "ip", () =>
    checkIncrementedLimit(repository, `abuse:ip:${ip}`, 100, 3600),
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
