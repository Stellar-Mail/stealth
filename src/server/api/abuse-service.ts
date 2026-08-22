import { createHash } from "node:crypto";

import type { ApiRepository } from "./repository";
import * as metrics from "./metrics";

function rateLimited(retryAfterSeconds: number) {
  return { allowed: false, retryAfterSeconds };
}

export type AbuseRoute =
  "postage_submit" | "registration" | "verification" | "password_reset" | "testnet_funding";

export type AbuseCheck =
  | "account"
  | "device"
  | "ip"
  | "proof_failure"
  | "relay"
  | "sender_recipient"
  | "email_domain"
  | "username_reservation"
  | "token_guessing"
  | "invite_code";

export type AbuseOutagePolicy = "fail_closed" | "fail_open";

export type AbuseDecision = {
  allowed: boolean;
  flagged?: boolean;
  reason?: string;
  outage?: {
    check: AbuseCheck;
    policy: AbuseOutagePolicy;
    route: AbuseRoute;
  };
  retryAfterSeconds?: number;
};

export const ABUSE_OUTAGE_POLICIES: Record<
  AbuseRoute,
  Partial<Record<AbuseCheck, AbuseOutagePolicy>>
> = {
  postage_submit: {
    account: "fail_closed",
    device: "fail_open",
    ip: "fail_open",
    proof_failure: "fail_closed",
    relay: "fail_open",
    sender_recipient: "fail_closed",
  },
  registration: {
    account: "fail_closed",
    device: "fail_open",
    ip: "fail_closed",
    proof_failure: "fail_closed",
    relay: "fail_open",
    sender_recipient: "fail_closed",
    email_domain: "fail_closed",
    username_reservation: "fail_closed",
    token_guessing: "fail_closed",
    invite_code: "fail_closed",
  },
  verification: {
    account: "fail_closed",
    device: "fail_open",
    ip: "fail_closed",
    proof_failure: "fail_closed",
    relay: "fail_open",
    sender_recipient: "fail_closed",
    email_domain: "fail_open",
    username_reservation: "fail_closed",
    token_guessing: "fail_closed",
    invite_code: "fail_closed",
  },
  password_reset: {
    account: "fail_closed",
    device: "fail_open",
    ip: "fail_closed",
    proof_failure: "fail_closed",
    relay: "fail_open",
    sender_recipient: "fail_closed",
    email_domain: "fail_open",
    username_reservation: "fail_closed",
    token_guessing: "fail_closed",
    invite_code: "fail_closed",
  },
  testnet_funding: {
    account: "fail_closed",
    device: "fail_open",
    ip: "fail_closed",
    proof_failure: "fail_closed",
    relay: "fail_open",
    sender_recipient: "fail_closed",
    email_domain: "fail_open",
    username_reservation: "fail_closed",
    token_guessing: "fail_closed",
    invite_code: "fail_closed",
  },
};

const OUTAGE_RETRY_AFTER_SECONDS = 60;

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "mailinator.com",
  "10minutemail.com",
  "guerrillamail.com",
  "tempmail.com",
  "trashmail.com",
  "dispostable.com",
  "yopmail.com",
  "sharklasers.com",
]);

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
    const routePolicies = ABUSE_OUTAGE_POLICIES[route] ?? ABUSE_OUTAGE_POLICIES.registration;
    const policy = routePolicies[check] ?? "fail_closed";
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
  max = 100,
  windowSeconds = 3600,
): Promise<AbuseDecision> {
  if (ip === "" || ip === "unknown") {
    return { allowed: true, flagged: true };
  }

  const key = route === "postage_submit" ? `abuse:ip:${ip}` : `abuse:ip:${ip}:${route}`;

  return withOutagePolicy(route, "ip", () =>
    checkIncrementedLimit(repository, key, max, windowSeconds),
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

// ---------------------------------------------------------------------------
// BETA-079 (Issue #1986) — Registration & Account Recovery Hardening Controls
// ---------------------------------------------------------------------------

export async function checkEmailDomainLimit(
  repository: ApiRepository,
  email: string,
  maxDailyPerDomain = 10,
): Promise<AbuseDecision> {
  const parts = email.toLowerCase().trim().split("@");
  if (parts.length !== 2) {
    return { allowed: false, reason: "invalid_email_domain" };
  }

  const domain = parts[1];

  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    metrics.incrementCounter("abuse_disposable_email_blocked", { domain });
    return { allowed: false, reason: "disposable_email_blocked" };
  }

  return withOutagePolicy("registration", "email_domain", () =>
    checkIncrementedLimit(repository, `abuse:domain:${domain}`, maxDailyPerDomain, 86400),
  );
}

export async function checkUsernameReservationLimit(
  repository: ApiRepository,
  ip: string,
  maxPerHour = 10,
): Promise<AbuseDecision> {
  return withOutagePolicy("registration", "username_reservation", () =>
    checkIncrementedLimit(repository, `abuse:user_res:${ip}`, maxPerHour, 3600),
  );
}

export async function checkInviteCode(
  repository: ApiRepository,
  inviteCode?: string,
  envOpts?: { inviteCodeRequired?: boolean; validCodes?: string[] },
): Promise<AbuseDecision> {
  const isRequired = envOpts?.inviteCodeRequired ?? false;
  if (!isRequired) {
    return { allowed: true };
  }

  if (!inviteCode || !inviteCode.trim()) {
    return { allowed: false, reason: "invite_code_required" };
  }

  const validCodes = envOpts?.validCodes ?? ["STEALTH_BETA_2026", "BETA_INVITE_VIP"];
  const normalized = inviteCode.trim().toUpperCase();

  if (!validCodes.includes(normalized)) {
    metrics.incrementCounter("abuse_invite_code_invalid", { code: normalized });
    return { allowed: false, reason: "invite_code_invalid" };
  }

  return { allowed: true };
}

export async function checkVerificationTokenAbuse(
  repository: ApiRepository,
  tokenId: string,
  ip: string,
  maxFailedAttempts = 5,
): Promise<AbuseDecision> {
  const ipCheck = await checkIpLimit(repository, ip, "verification", 10, 3600);
  if (!ipCheck.allowed) return ipCheck;

  const failedCount = await repository.getCounter(`abuse:token_fail:${tokenId}`);
  if (failedCount >= maxFailedAttempts) {
    metrics.incrementCounter("abuse_verification_token_locked", { tokenId });
    return { allowed: false, reason: "token_locked_max_attempts", retryAfterSeconds: 3600 };
  }

  return { allowed: true };
}

export async function recordVerificationTokenFailure(
  repository: ApiRepository,
  tokenId: string,
): Promise<void> {
  await repository.incrementCounter(`abuse:token_fail:${tokenId}`, 3600);
}

export async function checkPasswordResetAbuse(
  repository: ApiRepository,
  identifier: string,
  ip: string,
): Promise<AbuseDecision> {
  const ipCheck = await checkIpLimit(repository, ip, "password_reset", 10, 3600);
  if (!ipCheck.allowed) return ipCheck;

  const accountCheck = await withOutagePolicy("password_reset", "account", () =>
    checkIncrementedLimit(
      repository,
      `abuse:reset_acct:${identifier.toLowerCase().trim()}`,
      3,
      3600,
    ),
  );

  return accountCheck;
}

export async function checkTestnetFundingAbuse(
  repository: ApiRepository,
  account: string,
  ip: string,
): Promise<AbuseDecision> {
  const ipCheck = await checkIpLimit(repository, ip, "testnet_funding", 3, 86400);
  if (!ipCheck.allowed) return ipCheck;

  return withOutagePolicy("testnet_funding", "account", () =>
    checkIncrementedLimit(repository, `abuse:funding:${account}`, 1, 86400),
  );
}

export function createChallengeNonce(secretKey = "stealth_challenge_secret"): {
  challengeId: string;
  difficulty: number;
} {
  const challengeId = `chal_${crypto.randomUUID().replace(/-/g, "")}`;
  return { challengeId, difficulty: 2 };
}

export function validateChallengeSolution(
  challengeId: string,
  solutionNonce: string,
  difficulty = 2,
): boolean {
  if (!challengeId || !solutionNonce) return false;
  const hash = createHash("sha256").update(`${challengeId}:${solutionNonce}`).digest("hex");
  const prefix = "0".repeat(difficulty);
  return hash.startsWith(prefix);
}
