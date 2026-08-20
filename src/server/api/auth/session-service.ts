import type { ApiContext } from "../context";
import type { RetiredSession, Session, User } from "../domain";
import { ApiError } from "../errors";
import { recordAuditEvent } from "../audit";
import { dummyVerifyPassword, verifyPassword } from "./password";

export const SESSION_COOKIE_NAME = "stealth_session";
export const DEFAULT_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
export const DEFAULT_IDLE_TIMEOUT_SECONDS = 1800; // 30 minutes
export const DEFAULT_ABSOLUTE_TIMEOUT_SECONDS = 7 * 24 * 60 * 60; // 7 days
export const CONCURRENT_RENEWAL_GRACE_PERIOD_MS = 10 * 1000; // 10 seconds
export const MAX_LOGIN_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_SECONDS = 900; // 15 minutes

export interface AuthenticateInput {
  identifier: string;
  password: string;
  ip?: string;
  userAgent?: string;
  deviceFingerprint?: string;
  currentSessionId?: string;
}

export interface SessionOptions {
  now?: () => Date;
  idleTtlSeconds?: number;
  absoluteTtlSeconds?: number;
}

export interface LogoutOptions {
  isProd?: boolean;
  domain?: string;
  host?: string;
}

export function parseSessionCookie(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  const pairs = cookieHeader.split(";");
  for (const pair of pairs) {
    const trimmed = pair.trim();
    if (!trimmed) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    const value = trimmed.substring(eqIdx + 1).trim();
    if (key === SESSION_COOKIE_NAME) {
      return value || null;
    }
  }
  return null;
}

export function buildSessionCookie(
  sessionId: string,
  maxAgeSeconds = DEFAULT_SESSION_TTL_SECONDS,
  isProd = false,
): string {
  const expires = new Date(Date.now() + maxAgeSeconds * 1000).toUTCString();
  const secureFlag = isProd ? "Secure; " : "";
  return `${SESSION_COOKIE_NAME}=${sessionId}; HttpOnly; ${secureFlag}SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}; Expires=${expires}`;
}

export function buildClearSessionCookie(isProd = false, domain?: string): string {
  const secureFlag = isProd ? "Secure; " : "";
  const domainFlag = domain ? `Domain=${domain}; ` : "";
  return `${SESSION_COOKIE_NAME}=; HttpOnly; ${secureFlag}${domainFlag}SameSite=Lax; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export function buildClearSessionCookies(isProd = false, domain?: string): string[] {
  const primary = buildClearSessionCookie(isProd);
  if (!domain) return [primary];

  const cleanDomain = domain.split(":")[0];
  const domainCookie = buildClearSessionCookie(isProd, cleanDomain);
  return primary === domainCookie ? [primary] : [primary, domainCookie];
}

/**
 * Validates credentials with constant-time failure behavior, checks account status,
 * rotates session identifiers, and records session metadata.
 */
export async function authenticateWithPassword(
  apiContext: ApiContext,
  input: AuthenticateInput,
  options: SessionOptions = {},
): Promise<{ user: User; session: Session; cookieHeader: string }> {
  const repo = apiContext.repository;
  const normalizedId = input.identifier.trim().toLowerCase();

  if (!normalizedId || !input.password) {
    throw new ApiError(400, "bad_request", "Identifier and password are required");
  }

  // Enforce throttling on repeated login failures
  const rateLimitKey = `login:fail:${normalizedId}`;
  const failCount = await repo.getCounter(rateLimitKey);
  if (failCount >= MAX_LOGIN_ATTEMPTS) {
    throw new ApiError(429, "too_many_requests", "Too many login attempts. Please try again later");
  }

  // Lookup user by email or username
  let user = await repo.getUserByEmail(normalizedId);
  if (!user) {
    user = await repo.getUserByUsername(normalizedId);
  }

  const credential = user ? await repo.getCredential(user.userId) : null;

  let isValidPassword = false;
  if (user && credential && credential.authMethod === "password_hash") {
    const parts = credential.secretHash.split(/[:$]/);
    if (parts.length >= 2) {
      const storedHash = parts[0];
      const saltHex = parts[1];
      isValidPassword = await verifyPassword(input.password, storedHash, saltHex);
    } else {
      await dummyVerifyPassword(input.password);
    }
  } else {
    // Constant-time execution path when user or credential is missing
    await dummyVerifyPassword(input.password);
  }

  if (!user || !credential || !isValidPassword) {
    await repo.incrementCounter(rateLimitKey, RATE_LIMIT_WINDOW_SECONDS, 1);
    throw new ApiError(401, "unauthorized", "Invalid email/username or password");
  }

  // Account status checks
  if (user.status === "pending_verification") {
    throw new ApiError(403, "forbidden", "Account verification required");
  }
  if (user.status === "suspended") {
    throw new ApiError(403, "forbidden", "Account suspended");
  }
  if (user.status === "deactivated") {
    throw new ApiError(403, "forbidden", "Account deactivated");
  }
  if (user.status !== "active") {
    throw new ApiError(403, "forbidden", "Account is not active");
  }

  const now = options.now ? options.now() : new Date();
  const nowMs = now.getTime();
  const idleTtl = options.idleTtlSeconds ?? DEFAULT_IDLE_TIMEOUT_SECONDS;
  const absoluteTtl = options.absoluteTtlSeconds ?? DEFAULT_ABSOLUTE_TIMEOUT_SECONDS;

  const absoluteExpiresMs = nowMs + absoluteTtl * 1000;
  const idleExpiresMs = nowMs + idleTtl * 1000;
  const expiresMs = Math.min(idleExpiresMs, absoluteExpiresMs);

  const newSessionId = `sess_${crypto.randomUUID().replace(/-/g, "")}`;

  // Session fixation prevention: rotate session if a previous session exists
  if (input.currentSessionId) {
    const retiredSession: RetiredSession = {
      sessionId: input.currentSessionId,
      replacedBySessionId: newSessionId,
      userId: user.userId,
      retiredAt: now.toISOString(),
      expiresAt: now.toISOString(),
    };
    await repo.createRetiredSession(retiredSession);
    await repo.deleteSession(input.currentSessionId);
  }

  const session: Session = {
    sessionId: newSessionId,
    userId: user.userId,
    createdAt: now.toISOString(),
    expiresAt: new Date(expiresMs).toISOString(),
    lastActiveAt: now.toISOString(),
    absoluteExpiresAt: new Date(absoluteExpiresMs).toISOString(),
    ipAddress: input.ip ?? null,
    userAgent: input.userAgent ?? null,
    deviceFingerprint: input.deviceFingerprint ?? null,
    // Issue #1917 (BETA-010): a password login is the freshest possible
    // "recent login", satisfying recovery-code regeneration's window check.
    recentLoginAt: now.toISOString(),
  };

  await repo.createSession(session);

  const isProd = import.meta.env?.PROD ?? false;
  const maxAgeSeconds = Math.max(0, Math.floor((expiresMs - nowMs) / 1000));
  const cookieHeader = buildSessionCookie(newSessionId, maxAgeSeconds, isProd);

  return { user, session, cookieHeader };
}

/**
 * Validates a session by ID, enforcing idle timeout, absolute lifetime expiry,
 * account status, and retired session reuse protection.
 */
export async function validateSession(
  apiContext: ApiContext,
  sessionId: string,
  options: SessionOptions = {},
): Promise<{ user: User; session: Session } | null> {
  const repo = apiContext.repository;
  const now = options.now ? options.now() : new Date();
  const nowMs = now.getTime();

  // 1. Look up active session
  const session = await repo.getSession(sessionId);

  if (session) {
    const expiresAtMs = new Date(session.expiresAt).getTime();
    const absoluteExpiresAtMs = session.absoluteExpiresAt
      ? new Date(session.absoluteExpiresAt).getTime()
      : Number.POSITIVE_INFINITY;

    // Check idle expiration or absolute expiration
    if (nowMs >= expiresAtMs || nowMs >= absoluteExpiresAtMs) {
      await repo.deleteSession(sessionId);
      return null;
    }

    const user = await repo.getUserById(session.userId);
    if (!user || user.status !== "active") {
      return null;
    }

    // Extend sliding window for idle timeout, bounded by absoluteExpiresAt
    const idleTtl = options.idleTtlSeconds ?? DEFAULT_IDLE_TIMEOUT_SECONDS;
    const nextIdleExpiresMs = nowMs + idleTtl * 1000;
    const nextExpiresMs = Math.min(nextIdleExpiresMs, absoluteExpiresAtMs);

    const updatedSession: Session = {
      ...session,
      lastActiveAt: now.toISOString(),
      expiresAt: new Date(nextExpiresMs).toISOString(),
    };

    await repo.updateSession(updatedSession);
    return { user, session: updatedSession };
  }

  // 2. Check retired sessions for rotation resolution or theft detection
  const retired = await repo.getRetiredSession(sessionId);
  if (retired) {
    const retiredAtMs = new Date(retired.retiredAt).getTime();

    // Concurrent renewal grace window: return replacement active session
    if (nowMs - retiredAtMs <= CONCURRENT_RENEWAL_GRACE_PERIOD_MS) {
      const replacement = await repo.getSession(retired.replacedBySessionId);
      if (replacement) {
        const user = await repo.getUserById(replacement.userId);
        if (user && user.status === "active") {
          return { user, session: replacement };
        }
      }
      return null;
    }

    // Stolen retired session ID reuse attempt past grace window!
    // Immediately revoke active replacement session and all user sessions for safety.
    await repo.deleteSession(retired.replacedBySessionId);
    await repo.deleteUserSessions(retired.userId);
    throw new ApiError(
      401,
      "unauthorized",
      "Retired session token reused. Session chain revoked for security.",
    );
  }

  return null;
}

/**
 * Renews and rotates a session identifier, generating a new session record
 * bound by the original absolute lifetime and creating a retired session marker.
 */
export async function renewSession(
  apiContext: ApiContext,
  sessionId: string,
  options: SessionOptions = {},
): Promise<{ user: User; session: Session; cookieHeader: string }> {
  const repo = apiContext.repository;
  const now = options.now ? options.now() : new Date();
  const nowMs = now.getTime();

  const validated = await validateSession(apiContext, sessionId, options);
  if (!validated) {
    throw new ApiError(401, "unauthorized", "Session invalid or expired");
  }

  const currentSession = validated.session;
  const user = validated.user;

  const absoluteExpiresAtMs = currentSession.absoluteExpiresAt
    ? new Date(currentSession.absoluteExpiresAt).getTime()
    : nowMs + (options.absoluteTtlSeconds ?? DEFAULT_ABSOLUTE_TIMEOUT_SECONDS) * 1000;

  if (nowMs >= absoluteExpiresAtMs) {
    await repo.deleteSession(currentSession.sessionId);
    throw new ApiError(401, "unauthorized", "Session has reached maximum absolute lifetime");
  }

  const idleTtl = options.idleTtlSeconds ?? DEFAULT_IDLE_TIMEOUT_SECONDS;
  const nextIdleExpiresMs = nowMs + idleTtl * 1000;
  const nextExpiresMs = Math.min(nextIdleExpiresMs, absoluteExpiresAtMs);

  const newSessionId = `sess_${crypto.randomUUID().replace(/-/g, "")}`;
  const newSession: Session = {
    sessionId: newSessionId,
    userId: user.userId,
    createdAt: currentSession.createdAt,
    expiresAt: new Date(nextExpiresMs).toISOString(),
    lastActiveAt: now.toISOString(),
    absoluteExpiresAt: new Date(absoluteExpiresAtMs).toISOString(),
    rotatedFromSessionId: currentSession.sessionId,
    ipAddress: currentSession.ipAddress,
    userAgent: currentSession.userAgent,
    deviceFingerprint: currentSession.deviceFingerprint,
    // Issue #1917 (BETA-010): preserve the "recent login" marker across
    // rotation — renewing a session must not downgrade recovery privileges.
    recentLoginAt: currentSession.recentLoginAt,
  };

  // 1. Record retired session marker
  const retiredSession: RetiredSession = {
    sessionId: currentSession.sessionId,
    replacedBySessionId: newSessionId,
    userId: user.userId,
    retiredAt: now.toISOString(),
    expiresAt: currentSession.expiresAt,
  };
  await repo.createRetiredSession(retiredSession);

  // 2. Remove old session & save new session
  await repo.deleteSession(currentSession.sessionId);
  await repo.createSession(newSession);

  const isProd = import.meta.env?.PROD ?? false;
  const maxAgeSeconds = Math.max(0, Math.floor((nextExpiresMs - nowMs) / 1000));
  const cookieHeader = buildSessionCookie(newSessionId, maxAgeSeconds, isProd);

  return { user, session: newSession, cookieHeader };
}

/**
 * Rotates session identifiers after privilege-sensitive events.
 */
export async function rotateSession(
  apiContext: ApiContext,
  sessionId: string,
  options: SessionOptions = {},
): Promise<{ user: User; session: Session; cookieHeader: string }> {
  return renewSession(apiContext, sessionId, options);
}

/**
 * Logout session by revoking the session token, generating clear cookies, and logging audit event.
 */
export async function logoutSession(
  apiContext: ApiContext,
  sessionId: string | null,
  options: LogoutOptions = {},
): Promise<{ cookieHeader: string; cookieHeaders: string[] }> {
  let userId: string | null = null;
  if (sessionId) {
    const session = await apiContext.repository.getSession(sessionId);
    if (session) {
      userId = session.userId;
    }
    await apiContext.repository.deleteSession(sessionId);
  }

  const isProd = options.isProd ?? import.meta.env?.PROD ?? false;
  const domain = options.domain ?? (options.host ? options.host.split(":")[0] : undefined);
  const cookieHeaders = buildClearSessionCookies(isProd, domain);
  const cookieHeader = cookieHeaders[0];

  recordAuditEvent({
    actor: userId ?? apiContext.principal?.address ?? "anonymous",
    action: "auth.logout",
    targetType: "session",
    safeTargetReference: sessionId ? `${sessionId.substring(0, 12)}...` : "none",
    result: "success",
    requestId: apiContext.requestId ?? "unknown",
  });

  return { cookieHeader, cookieHeaders };
}

/**
 * Revokes all active sessions for a given user ID, generating clear cookies and logging audit event.
 */
export async function revokeAllSessions(
  apiContext: ApiContext,
  userId: string,
  options: LogoutOptions = {},
): Promise<{ cookieHeader: string; cookieHeaders: string[] }> {
  await apiContext.repository.deleteUserSessions(userId);

  const isProd = options.isProd ?? import.meta.env?.PROD ?? false;
  const domain = options.domain ?? (options.host ? options.host.split(":")[0] : undefined);
  const cookieHeaders = buildClearSessionCookies(isProd, domain);
  const cookieHeader = cookieHeaders[0];

  recordAuditEvent({
    actor: userId,
    action: "auth.logout_all",
    targetType: "account_sessions",
    safeTargetReference: userId,
    result: "success",
    requestId: apiContext.requestId ?? "unknown",
  });

  return { cookieHeader, cookieHeaders };
}
