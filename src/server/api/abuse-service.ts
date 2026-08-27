import { createHash, timingSafeEqual } from "node:crypto";

import type { ApiRepository } from "./repository";
import * as metrics from "./metrics";

function rateLimited(retryAfterSeconds: number) {
  return { allowed: false, retryAfterSeconds };
}

export type AbuseRoute =
  | "postage_submit"
  | "postage_transition"
  | "registration"
  | "verification"
  | "password_reset"
  | "testnet_funding"
  | "relay_submit"
  | "attachment_upload"
  | "send_coordinate"
  | "auth_login"
  | "general_api";

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
  | "invite_code"
  | "storage_bytes"
  | "chain_write"
  | "session"
  | "recipient";

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
    chain_write: "fail_closed",
    recipient: "fail_closed",
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
    chain_write: "fail_closed",
  },
  relay_submit: {
    account: "fail_closed",
    device: "fail_open",
    ip: "fail_closed",
    relay: "fail_open",
    sender_recipient: "fail_closed",
    storage_bytes: "fail_closed",
    recipient: "fail_closed",
  },
  attachment_upload: {
    account: "fail_closed",
    device: "fail_open",
    ip: "fail_closed",
    session: "fail_closed",
    storage_bytes: "fail_closed",
  },
  send_coordinate: {
    account: "fail_closed",
    device: "fail_open",
    ip: "fail_closed",
    recipient: "fail_closed",
    sender_recipient: "fail_closed",
    chain_write: "fail_closed",
  },
  postage_transition: {
    account: "fail_closed",
    device: "fail_open",
    ip: "fail_closed",
    chain_write: "fail_closed",
  },
  auth_login: {
    account: "fail_closed",
    device: "fail_open",
    ip: "fail_closed",
    session: "fail_open",
  },
  general_api: {
    account: "fail_closed",
    device: "fail_open",
    ip: "fail_open",
    session: "fail_open",
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

export function canonicalizeSubjectAddress(address?: string): string {
  if (!address) return "";
  const trimmed = address.trim();
  if (trimmed.startsWith("G") || trimmed.startsWith("g")) {
    return trimmed.toUpperCase();
  }
  return trimmed;
}

export async function checkAccountLimit(
  repository: ApiRepository,
  sender: string,
  route: AbuseRoute = "postage_submit",
): Promise<AbuseDecision> {
  const canonicalSender = canonicalizeSubjectAddress(sender);
  return withOutagePolicy(route, "account", () =>
    checkIncrementedLimit(repository, `abuse:account:${canonicalSender}`, 50, 3600),
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
  const canonicalSender = canonicalizeSubjectAddress(sender);
  const canonicalRecipient = canonicalizeSubjectAddress(recipient);
  return withOutagePolicy(route, "sender_recipient", () =>
    checkIncrementedLimit(
      repository,
      `abuse:pair:${canonicalSender}:${canonicalRecipient}`,
      10,
      3600,
    ),
  );
}

export async function checkProofFailureLimit(
  repository: ApiRepository,
  sender: string,
  route: AbuseRoute = "postage_submit",
): Promise<AbuseDecision> {
  const canonicalSender = canonicalizeSubjectAddress(sender);
  return withOutagePolicy(route, "proof_failure", () =>
    checkStoredLimit(repository, `abuse:proof:${canonicalSender}`, 5, 900),
  );
}

export async function recordProofFailure(repository: ApiRepository, sender: string): Promise<void> {
  const canonicalSender = canonicalizeSubjectAddress(sender);
  await repository.incrementCounter(`abuse:proof:${canonicalSender}`, 900);
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

// ---------------------------------------------------------------------------
// BETA-049 (Issue #1956) — Beta Abuse Controls & Budgets
// ---------------------------------------------------------------------------

export const STORAGE_BYTE_UNIT = 64 * 1024; // 64KB per quota unit

export const STORAGE_BYTE_BUDGETS = {
  account: {
    maxBytes: 50 * 1024 * 1024,
    maxUnits: Math.floor((50 * 1024 * 1024) / STORAGE_BYTE_UNIT),
    windowSeconds: 3600,
  },
  ip: {
    maxBytes: 100 * 1024 * 1024,
    maxUnits: Math.floor((100 * 1024 * 1024) / STORAGE_BYTE_UNIT),
    windowSeconds: 3600,
  },
  session: {
    maxBytes: 25 * 1024 * 1024,
    maxUnits: Math.floor((25 * 1024 * 1024) / STORAGE_BYTE_UNIT),
    windowSeconds: 3600,
  },
} as const;

export async function checkStorageByteBudget(
  repository: ApiRepository,
  subjects: { ip?: string; account?: string; session?: string },
  bytesToAdd: number,
  route: AbuseRoute = "attachment_upload",
): Promise<AbuseDecision> {
  return withOutagePolicy(route, "storage_bytes", async () => {
    if (bytesToAdd <= 0) return { allowed: true };
    const unitsToAdd = Math.max(1, Math.ceil(bytesToAdd / STORAGE_BYTE_UNIT));

    if (subjects.account) {
      const canonicalAcct = canonicalizeSubjectAddress(subjects.account);
      if (canonicalAcct) {
        const count = await repository.incrementCounter(
          `abuse:storage:account:${canonicalAcct}`,
          STORAGE_BYTE_BUDGETS.account.windowSeconds,
          unitsToAdd,
        );
        if (count > STORAGE_BYTE_BUDGETS.account.maxUnits) {
          metrics.incrementCounter("abuse_storage_bytes_exceeded", {
            route,
            subject: "account",
            limit: String(STORAGE_BYTE_BUDGETS.account.maxBytes),
          });
          return {
            allowed: false,
            reason: "storage_byte_budget_exceeded",
            retryAfterSeconds: STORAGE_BYTE_BUDGETS.account.windowSeconds,
          };
        }
      }
    }

    if (subjects.session) {
      const sess = subjects.session.trim();
      if (sess && sess !== "unknown") {
        const count = await repository.incrementCounter(
          `abuse:storage:session:${sess}`,
          STORAGE_BYTE_BUDGETS.session.windowSeconds,
          unitsToAdd,
        );
        if (count > STORAGE_BYTE_BUDGETS.session.maxUnits) {
          metrics.incrementCounter("abuse_storage_bytes_exceeded", {
            route,
            subject: "session",
            limit: String(STORAGE_BYTE_BUDGETS.session.maxBytes),
          });
          return {
            allowed: false,
            reason: "storage_byte_budget_exceeded",
            retryAfterSeconds: STORAGE_BYTE_BUDGETS.session.windowSeconds,
          };
        }
      }
    }

    const ip = subjects.ip?.trim() ?? "unknown";
    if (ip !== "" && ip !== "unknown") {
      const count = await repository.incrementCounter(
        `abuse:storage:ip:${ip}`,
        STORAGE_BYTE_BUDGETS.ip.windowSeconds,
        unitsToAdd,
      );
      if (count > STORAGE_BYTE_BUDGETS.ip.maxUnits) {
        metrics.incrementCounter("abuse_storage_bytes_exceeded", {
          route,
          subject: "ip",
          limit: String(STORAGE_BYTE_BUDGETS.ip.maxBytes),
        });
        return {
          allowed: false,
          reason: "storage_byte_budget_exceeded",
          retryAfterSeconds: STORAGE_BYTE_BUDGETS.ip.windowSeconds,
        };
      }
    }

    return { allowed: true };
  });
}

export const CHAIN_WRITE_BUDGETS = {
  account: { max: 20, windowSeconds: 3600 },
  ip: { max: 50, windowSeconds: 3600 },
} as const;

export async function checkChainWriteBudget(
  repository: ApiRepository,
  subjects: { ip?: string; account?: string },
  route: AbuseRoute = "postage_submit",
): Promise<AbuseDecision> {
  return withOutagePolicy(route, "chain_write", async () => {
    if (subjects.account) {
      const canonicalAcct = canonicalizeSubjectAddress(subjects.account);
      if (canonicalAcct) {
        const count = await repository.incrementCounter(
          `abuse:chain:account:${canonicalAcct}`,
          CHAIN_WRITE_BUDGETS.account.windowSeconds,
        );
        if (count > CHAIN_WRITE_BUDGETS.account.max) {
          metrics.incrementCounter("abuse_chain_writes_exceeded", {
            route,
            subject: "account",
            limit: String(CHAIN_WRITE_BUDGETS.account.max),
          });
          return {
            allowed: false,
            reason: "chain_write_budget_exceeded",
            retryAfterSeconds: CHAIN_WRITE_BUDGETS.account.windowSeconds,
          };
        }
      }
    }

    const ip = subjects.ip?.trim() ?? "unknown";
    if (ip !== "" && ip !== "unknown") {
      const count = await repository.incrementCounter(
        `abuse:chain:ip:${ip}`,
        CHAIN_WRITE_BUDGETS.ip.windowSeconds,
      );
      if (count > CHAIN_WRITE_BUDGETS.ip.max) {
        metrics.incrementCounter("abuse_chain_writes_exceeded", {
          route,
          subject: "ip",
          limit: String(CHAIN_WRITE_BUDGETS.ip.max),
        });
        return {
          allowed: false,
          reason: "chain_write_budget_exceeded",
          retryAfterSeconds: CHAIN_WRITE_BUDGETS.ip.windowSeconds,
        };
      }
    }

    return { allowed: true };
  });
}

export const SESSION_LIMITS = {
  max: 100,
  windowSeconds: 3600,
} as const;

export async function checkSessionLimit(
  repository: ApiRepository,
  sessionId: string,
  route: AbuseRoute = "general_api",
  max = SESSION_LIMITS.max,
  windowSeconds = SESSION_LIMITS.windowSeconds,
): Promise<AbuseDecision> {
  const session = sessionId.trim();
  if (!session || session === "unknown") return { allowed: true };

  return withOutagePolicy(route, "session", () =>
    checkIncrementedLimit(repository, `abuse:session:${session}`, max, windowSeconds),
  );
}

export const RECIPIENT_LIMITS = {
  max: 50,
  windowSeconds: 3600,
} as const;

export async function checkRecipientLimit(
  repository: ApiRepository,
  recipient: string,
  route: AbuseRoute = "postage_submit",
  max = RECIPIENT_LIMITS.max,
  windowSeconds = RECIPIENT_LIMITS.windowSeconds,
): Promise<AbuseDecision> {
  const canonicalRecipient = canonicalizeSubjectAddress(recipient);
  if (!canonicalRecipient) return { allowed: true };

  return withOutagePolicy(route, "recipient", () =>
    checkIncrementedLimit(repository, `abuse:recipient:${canonicalRecipient}`, max, windowSeconds),
  );
}

export const OPERATOR_OVERRIDE_HEADER = "x-stealth-operator-override";

export function isOperatorOverride(
  headers?: Headers | Record<string, string | string[] | undefined> | null,
): boolean {
  if (!headers) return false;
  const configuredSecret = process.env.STEALTH_OPERATOR_OVERRIDE_TOKEN?.trim();
  if (!configuredSecret) {
    return false;
  }
  let val: string | undefined | null;
  if (headers instanceof Headers) {
    val = headers.get(OPERATOR_OVERRIDE_HEADER);
  } else {
    const raw =
      headers[OPERATOR_OVERRIDE_HEADER] ?? headers[OPERATOR_OVERRIDE_HEADER.toLowerCase()];
    val = Array.isArray(raw) ? raw[0] : raw;
  }
  if (!val) return false;
  const token = val.trim();
  if (token.length === 0 || token.length !== configuredSecret.length) {
    return false;
  }
  try {
    return timingSafeEqual(Buffer.from(token, "utf8"), Buffer.from(configuredSecret, "utf8"));
  } catch {
    return false;
  }
}

export interface CentralAbuseOptions {
  route: AbuseRoute;
  ip?: string;
  session?: string;
  account?: string;
  recipient?: string;
  storageBytes?: number;
  isChainWrite?: boolean;
  fingerprint?: string;
  relayId?: string;
  headers?: Headers | Record<string, string | string[] | undefined> | null;
}

export async function enforceCentralAbuse(
  repository: ApiRepository,
  opts: CentralAbuseOptions,
): Promise<AbuseDecision> {
  if (isOperatorOverride(opts.headers)) {
    metrics.incrementCounter("abuse_operator_override", {
      route: opts.route,
      operatorId: "operator",
    });
    return { allowed: true };
  }

  // Canonicalize addresses
  const canonicalAccount = opts.account ? canonicalizeSubjectAddress(opts.account) : undefined;
  const canonicalRecipient = opts.recipient
    ? canonicalizeSubjectAddress(opts.recipient)
    : undefined;

  // 1. IP check
  if (opts.ip) {
    const ipCheck = await checkIpLimit(repository, opts.ip, opts.route);
    if (!ipCheck.allowed) {
      metrics.incrementCounter("abuse_throttled", {
        route: opts.route,
        type: "ip",
        subject: opts.ip,
      });
      return ipCheck;
    }
  }

  // 2. Session check
  if (opts.session) {
    const sessionCheck = await checkSessionLimit(repository, opts.session, opts.route);
    if (!sessionCheck.allowed) {
      metrics.incrementCounter("abuse_throttled", {
        route: opts.route,
        type: "session",
        subject: opts.session,
      });
      return sessionCheck;
    }
  }

  // 3. Account check
  if (canonicalAccount) {
    const accountCheck = await checkAccountLimit(repository, canonicalAccount, opts.route);
    if (!accountCheck.allowed) {
      metrics.incrementCounter("abuse_throttled", {
        route: opts.route,
        type: "account",
        subject: canonicalAccount,
      });
      return accountCheck;
    }
  }

  // 4. Recipient check
  if (canonicalRecipient) {
    const recipientCheck = await checkRecipientLimit(repository, canonicalRecipient, opts.route);
    if (!recipientCheck.allowed) {
      metrics.incrementCounter("abuse_throttled", {
        route: opts.route,
        type: "recipient",
        subject: canonicalRecipient,
      });
      return recipientCheck;
    }
  }

  // 5. Sender-Recipient pair check
  if (canonicalAccount && canonicalRecipient) {
    const pairCheck = await checkSenderRecipientLimit(
      repository,
      canonicalAccount,
      canonicalRecipient,
      opts.route,
    );
    if (!pairCheck.allowed) {
      metrics.incrementCounter("abuse_throttled", {
        route: opts.route,
        type: "sender_recipient",
        subject: `${canonicalAccount}:${canonicalRecipient}`,
      });
      return pairCheck;
    }
  }

  // 6. Storage byte budget check
  if (opts.storageBytes && opts.storageBytes > 0) {
    const storageCheck = await checkStorageByteBudget(
      repository,
      { ip: opts.ip, account: canonicalAccount, session: opts.session },
      opts.storageBytes,
      opts.route,
    );
    if (!storageCheck.allowed) {
      metrics.incrementCounter("abuse_throttled", {
        route: opts.route,
        type: "storage_bytes",
        subject: canonicalAccount || opts.ip || "unknown",
      });
      return storageCheck;
    }
  }

  // 7. Chain write budget check
  if (opts.isChainWrite) {
    const chainCheck = await checkChainWriteBudget(
      repository,
      { ip: opts.ip, account: canonicalAccount },
      opts.route,
    );
    if (!chainCheck.allowed) {
      metrics.incrementCounter("abuse_throttled", {
        route: opts.route,
        type: "chain_write",
        subject: canonicalAccount || opts.ip || "unknown",
      });
      return chainCheck;
    }
  }

  // 8. Device fingerprint check
  if (opts.fingerprint) {
    const deviceCheck = await checkDeviceLimit(repository, opts.fingerprint, { route: opts.route });
    if (!deviceCheck.allowed) {
      metrics.incrementCounter("abuse_throttled", {
        route: opts.route,
        type: "device",
        subject: opts.fingerprint,
      });
      return deviceCheck;
    }
  }

  // 9. Relay check
  if (opts.relayId) {
    const relayCheck = await checkRelayLimit(repository, opts.relayId, opts.route);
    if (!relayCheck.allowed) {
      metrics.incrementCounter("abuse_throttled", {
        route: opts.route,
        type: "relay",
        subject: opts.relayId,
      });
      return relayCheck;
    }
  }

  return { allowed: true };
}
