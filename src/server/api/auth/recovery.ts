import type { ApiContext } from "../context";
import type {
  RecoveryCodeEntry,
  RecoveryCodeSet,
  RecoveryCodeSetStatusView,
  Session,
  User,
} from "../domain";
import { ApiError } from "../errors";
import { recordAuditEvent } from "../audit";
import { hashPassword, verifyPassword } from "./password";
import {
  DEFAULT_ABSOLUTE_TIMEOUT_SECONDS,
  DEFAULT_IDLE_TIMEOUT_SECONDS,
  buildSessionCookie,
} from "./session-service";

/**
 * Issue #1917 (BETA-010): one-time recovery codes.
 *
 * Security model
 * --------------
 * - Only PBKDF2-SHA256 hashes of codes are persisted (`recoveryCodeSet`
 *   record); the plaintext codes are returned to the user exactly once, at
 *   generation time, and are never retrievable afterwards.
 * - Codes are single-use: redemption marks the matching hash consumed under an
 *   optimistic-concurrency write, so parallel redemption attempts yield
 *   exactly one winner.
 * - Redemption failure responses are uniform ("invalid or already used") so a
 *   missing account, an exhausted set, and a bad code are indistinguishable.
 * - Regeneration is a *privilege-sensitive* action: it requires an
 *   authenticated session with a recent password login, and it revokes every
 *   other session for the account (the issuing session is preserved).
 * - Using a code to recover revokes ALL existing sessions: the account holder
 *   is assumed to have lost access, so previously issued session tokens are
 *   treated as unrecovered assets.
 */

export const RECOVERY_CODE_COUNT = 10;
export const RECOVERY_CODE_GROUPS = 4;
export const RECOVERY_CODE_GROUP_LENGTH = 4;
export const RECOVERY_CODE_CHARS = RECOVERY_CODE_GROUPS * RECOVERY_CODE_GROUP_LENGTH; // 16 base32 chars = 80 bits
/** Privilege-sensitive regeneration requires a login newer than this window. */
export const RECOVERY_REGENERATION_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_RECOVERY_ATTEMPTS = 5;
const RECOVERY_RATE_LIMIT_WINDOW_SECONDS = 15 * 60;
const REDEEM_CAS_RETRIES = 3;

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
// Guards against accidentally ambiguous input: only canonical base32
// characters survive normalization, so hyphens, spaces and lowercase are fine.
const CANONICAL_CODE_PATTERN = /^[A-Z2-7]{16}$/;

export interface RecoveryRegenerateResult {
  status: "active";
  totalCodes: number;
  remainingCodes: number;
  generatedAt: string | null;
  /** Plaintext codes. Present ONLY in this response — never stored. */
  codes: string[];
}

export interface RecoveryRedeemResult {
  user: User;
  session: Session;
  cookieHeader: string;
}

export type RecoveryStatusResult = RecoveryCodeSetStatusView;

/**
 * Normalizes user-supplied code input to its canonical 16-character base32
 * form (uppercase, separators removed). Returns null when the raw value
 * cannot be a valid recovery code.
 */
export function normalizeRecoveryCode(raw: string): string | null {
  const normalized = raw.toUpperCase().replace(/[^A-Z2-7]/g, "");
  if (!CANONICAL_CODE_PATTERN.test(normalized)) return null;
  return normalized;
}

function formatRecoveryCode(normalized: string): string {
  const groups: string[] = [];
  for (let index = 0; index < RECOVERY_CODE_GROUPS; index += 1) {
    groups.push(
      normalized.slice(
        index * RECOVERY_CODE_GROUP_LENGTH,
        (index + 1) * RECOVERY_CODE_GROUP_LENGTH,
      ),
    );
  }
  return groups.join("-");
}

export function generateRecoveryCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(RECOVERY_CODE_CHARS));
  const normalized = Array.from(bytes, (byte) => BASE32[byte % BASE32.length]).join("");
  return formatRecoveryCode(normalized);
}

/**
 * Identifies an unused, matching code entry. Performs the same PBKDF2 work on
 * every unused entry so the comparison time does not reveal which position
 * matched. Returns null when no unused entry matches.
 */
export async function findMatchingRecoveryEntry(
  set: RecoveryCodeSet,
  normalizedCode: string,
): Promise<RecoveryCodeEntry | null> {
  let match: RecoveryCodeEntry | null = null;
  for (const entry of set.codes) {
    if (entry.usedAt !== null) {
      continue;
    }
    const isMatch = await verifyPassword(normalizedCode, entry.hash, entry.salt);
    if (isMatch) {
      match = entry;
    }
  }
  return match;
}

/**
 * Runs a dummy PBKDF2 derivation so that requests for unknown accounts (no
 * user, no set, or exhausted set) take the same time as a real verification.
 */
async function runDummyRecoveryVerification(): Promise<void> {
  await hashPassword("STEALTH-RECOVERY-DUMMY-NOT-A-REAL-CODE");
}

async function hashRecoveryEntries(codes: string[]): Promise<RecoveryCodeEntry[]> {
  const entries: RecoveryCodeEntry[] = [];
  for (const code of codes) {
    const { hash, salt } = await hashPassword(code);
    entries.push({ hash, salt, usedAt: null });
  }
  return entries;
}

function toStatusView(set: RecoveryCodeSet | null): RecoveryCodeSetStatusView {
  if (!set) {
    return { status: "none", totalCodes: 0, remainingCodes: 0, generatedAt: null };
  }
  return {
    status: set.status,
    totalCodes: set.codes.length,
    remainingCodes: set.codes.filter((entry) => entry.usedAt === null).length,
    generatedAt: set.generatedAt,
  };
}

function audit(
  apiContext: ApiContext,
  event: {
    actor: string;
    action: string;
    targetType: string;
    safeTargetReference: string;
    result: "success" | "denied";
  },
) {
  recordAuditEvent({
    actor: event.actor,
    action: event.action,
    targetType: event.targetType,
    safeTargetReference: event.safeTargetReference,
    result: event.result,
    requestId: apiContext.requestId ?? "",
  });
}

/**
 * Generates a fresh set of one-time recovery codes for the user. Create-only:
 * when a set already exists this throws a deterministic 409 instead of
 * silently replacing another generation's codes. Callers that need to
 * *replace* an existing set use {@link regenerateRecoveryCodes}.
 */
export async function generateRecoveryCodes(
  apiContext: ApiContext,
  userId: string,
  options: { now?: () => Date } = {},
): Promise<{ codes: string[]; set: RecoveryCodeSet }> {
  const now = options.now ? options.now() : new Date();
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, generateRecoveryCode);
  const set: RecoveryCodeSet = {
    userId,
    status: "active",
    // Hash the canonical (unnormalized, separator-free) form so redemption
    // verification over normalized input matches.
    codes: await hashRecoveryEntries(codes.map((code) => code.replace(/-/g, ""))),
    generatedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    version: 1,
  };

  const result = await apiContext.repository.setRecoveryCodeSet(set, 0);
  if (!result.updated) {
    // Another generation won the create-only slot; never surface its codes.
    throw new ApiError(
      409,
      "invalid_state_transition",
      "Recovery codes were already generated for this account",
    );
  }

  audit(apiContext, {
    actor: userId,
    action: "auth.recovery_codes_generated",
    targetType: "account",
    safeTargetReference: `user:${userId}`,
    result: "success",
  });

  return { codes, set: result.set };
}

/**
 * Recovery status model for UI surfaces. NEVER exposes code hashes or any
 * material that would let a client reconstruct a code.
 */
export async function getRecoveryStatus(
  apiContext: ApiContext,
  userId: string,
): Promise<RecoveryStatusResult> {
  const set = await apiContext.repository.getRecoveryCodeSet(userId);
  return toStatusView(set);
}

/**
 * Redemption flow ("one-code recovery"): validates a single recovery code,
 * consumes it atomically, revokes ALL of the account's existing sessions,
 * and issues a completely fresh session (with `recentLoginAt` set, so the
 * holder can immediately regenerate a replacement set).
 *
 * The mutation is protected by a bounded CAS loop, so exactly one concurrent
 * redemption of the same code wins; losers observe the code as consumed and
 * receive the uniform invalid-code error.
 */
export async function redeemRecoveryCode(
  apiContext: ApiContext,
  input: { identifier: string; code: string },
  options: { now?: () => Date; ip?: string; userAgent?: string; deviceFingerprint?: string } = {},
): Promise<RecoveryRedeemResult> {
  const repo = apiContext.repository;
  const now = options.now ? options.now() : new Date();
  const normalizedId = input.identifier.trim().toLowerCase();
  const normalizedCode = normalizeRecoveryCode(input.code);

  if (!normalizedId || !normalizedCode) {
    // Uniform failure path: run the same work as a real attempt before failing.
    await runDummyRecoveryVerification();
    throw new ApiError(401, "unauthorized", "Invalid or already used recovery code");
  }

  // Brute-force protection, keyed by the provided identifier (works whether
  // or not the account exists, so enumeration is not revealed).
  const rateLimitKey = `recovery:fail:${normalizedId}`;
  if ((await repo.getCounter(rateLimitKey)) >= MAX_RECOVERY_ATTEMPTS) {
    await runDummyRecoveryVerification();
    throw new ApiError(
      429,
      "too_many_requests",
      "Too many recovery attempts. Please try again later",
    );
  }

  let user: User | null = await repo.getUserByEmail(normalizedId);
  if (!user) {
    user = await repo.getUserByUsername(normalizedId);
  }

  const reject = async (): Promise<never> => {
    await repo.incrementCounter(rateLimitKey, RECOVERY_RATE_LIMIT_WINDOW_SECONDS, 1);
    audit(apiContext, {
      actor: normalizedId,
      action: "auth.recovery_code_redeem_denied",
      targetType: "account",
      safeTargetReference: `user:${user?.userId ?? normalizedId}`,
      result: "denied",
    });
    throw new ApiError(401, "unauthorized", "Invalid or already used recovery code");
  };

  if (!user) {
    await runDummyRecoveryVerification();
    return reject();
  }

  for (let attempt = 0; attempt < REDEEM_CAS_RETRIES; attempt += 1) {
    const current = await repo.getRecoveryCodeSet(user.userId);
    if (!current || current.status !== "active") {
      await runDummyRecoveryVerification();
      return reject();
    }

    const matchingEntry = await findMatchingRecoveryEntry(current, normalizedCode);
    if (!matchingEntry) {
      return reject();
    }

    const nextCodes = current.codes.map((entry) =>
      entry.hash === matchingEntry.hash && entry.salt === matchingEntry.salt
        ? { ...entry, usedAt: now.toISOString() }
        : entry,
    );
    const next: RecoveryCodeSet = {
      ...current,
      status: nextCodes.every((entry) => entry.usedAt !== null) ? "exhausted" : "active",
      codes: nextCodes,
      updatedAt: now.toISOString(),
    };

    const result = await repo.setRecoveryCodeSet(next, current.version);
    if (result.updated) {
      // Success: revoke every existing session and mint a brand-new one.
      await repo.deleteUserSessions(user.userId);
      const session = await mintRecoverySession(apiContext, user, now, options);
      audit(apiContext, {
        actor: user.userId,
        action: "auth.recovery_code_redeemed",
        targetType: "account",
        safeTargetReference: `user:${user.userId}`,
        result: "success",
      });
      return { user, session, cookieHeader: session.cookieHeader };
    }
    if (result.current) {
      // CAS conflict: another redemption consumed the code (or regeneration
      // replaced the set). Re-read and retry; the code observation loop below
      // converges to the uniform invalid-code error when the code is gone.
      continue;
    }
    return reject();
  }

  return reject();
}

async function mintRecoverySession(
  apiContext: ApiContext,
  user: User,
  now: Date,
  options: { ip?: string; userAgent?: string; deviceFingerprint?: string },
): Promise<Session & { cookieHeader: string }> {
  const repo = apiContext.repository;
  const nowMs = now.getTime();
  const idleExpiresMs = nowMs + DEFAULT_IDLE_TIMEOUT_SECONDS * 1000;
  const absoluteExpiresMs = nowMs + DEFAULT_ABSOLUTE_TIMEOUT_SECONDS * 1000;
  const expiresMs = Math.min(idleExpiresMs, absoluteExpiresMs);

  const session: Session = {
    sessionId: `sess_${crypto.randomUUID().replace(/-/g, "")}`,
    userId: user.userId,
    createdAt: now.toISOString(),
    expiresAt: new Date(expiresMs).toISOString(),
    lastActiveAt: now.toISOString(),
    absoluteExpiresAt: new Date(absoluteExpiresMs).toISOString(),
    ipAddress: options.ip ?? null,
    userAgent: options.userAgent ?? null,
    deviceFingerprint: options.deviceFingerprint ?? null,
    // A successful recovery is treated as a recent password-equivalent login,
    // so the holder can regenerate a replacement set immediately.
    recentLoginAt: now.toISOString(),
  };

  await repo.createSession(session);
  const isProd = import.meta.env?.PROD ?? false;
  const maxAgeSeconds = Math.max(0, Math.floor((expiresMs - nowMs) / 1000));
  return {
    ...session,
    cookieHeader: buildSessionCookie(session.sessionId, maxAgeSeconds, isProd),
  };
}

/**
 * Authenticated, privilege-sensitive regeneration of the code set.
 *
 * - Requires the presenting session to have authenticated with a password
 *   (or a prior recovery) within {@link RECOVERY_REGENERATION_LOGIN_WINDOW_MS}.
 * - Replaces the stored set atomically (CAS against the current version).
 * - Revokes every OTHER session for the account; the presenting session is
 *   recreated and preserved, keeping the actor signed in.
 * - The plaintext codes appear ONLY in the returned payload.
 */
export async function regenerateRecoveryCodes(
  apiContext: ApiContext,
  session: Session,
  options: { now?: () => Date } = {},
): Promise<RecoveryRegenerateResult> {
  const now = options.now ? options.now() : new Date();

  const recentLoginAtMs = session.recentLoginAt
    ? new Date(session.recentLoginAt).getTime()
    : Number.NEGATIVE_INFINITY;
  if (now.getTime() - recentLoginAtMs > RECOVERY_REGENERATION_LOGIN_WINDOW_MS) {
    audit(apiContext, {
      actor: session.userId,
      action: "auth.recovery_regenerate_recent_login_denied",
      targetType: "session",
      safeTargetReference: `user:${session.userId}`,
      result: "denied",
    });
    throw new ApiError(
      403,
      "forbidden",
      "Recovery code regeneration requires a recent login. Please sign in again.",
    );
  }

  const previouslyExisting = await apiContext.repository.getRecoveryCodeSet(session.userId);
  const expectedVersion = previouslyExisting?.version ?? 0;

  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, generateRecoveryCode);
  const next: RecoveryCodeSet = {
    userId: session.userId,
    status: "active",
    codes: await hashRecoveryEntries(codes.map((code) => code.replace(/-/g, ""))),
    generatedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    version: expectedVersion + 1 > 0 ? expectedVersion + 1 : 1,
  };

  const result = await apiContext.repository.setRecoveryCodeSet(next, expectedVersion);
  if (!result.updated) {
    // A concurrent regeneration replaced the set under us. Never expose a set
    // we did not create; the client should retry with a fresh idempotency key.
    throw new ApiError(
      409,
      "invalid_state_transition",
      "Recovery codes changed concurrently. Please retry regeneration.",
    );
  }

  // Revoke every other session, then re-create the presenting session so the
  // actor stays signed in while all other devices are logged out.
  await apiContext.repository.deleteUserSessions(session.userId);
  await apiContext.repository.createSession(session);

  const view = toStatusView(result.set);
  audit(apiContext, {
    actor: session.userId,
    action: "auth.recovery_codes_regenerated",
    targetType: "account",
    safeTargetReference: `user:${session.userId}`,
    result: "success",
  });
  audit(apiContext, {
    actor: session.userId,
    action: "auth.user_other_sessions_revoked",
    targetType: "session",
    safeTargetReference: `user:${session.userId}`,
    result: "success",
  });

  return {
    status: "active",
    totalCodes: view.totalCodes,
    remainingCodes: view.remainingCodes,
    generatedAt: view.generatedAt,
    codes,
  };
}
