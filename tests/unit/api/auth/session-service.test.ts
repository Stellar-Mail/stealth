import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  authenticateWithPassword,
  buildClearSessionCookie,
  buildClearSessionCookies,
  buildSessionCookie,
  logoutSession,
  parseSessionCookie,
  renewSession,
  revokeAllSessions,
  rotateSession,
  validateSession,
  CONCURRENT_RENEWAL_GRACE_PERIOD_MS,
  DEFAULT_ABSOLUTE_TIMEOUT_SECONDS,
  DEFAULT_IDLE_TIMEOUT_SECONDS,
  MAX_LOGIN_ATTEMPTS,
} from "../../../../src/server/api/auth/session-service";
import { hashPassword } from "../../../../src/server/api/auth/password";
import { createApiContext } from "../../../../src/server/api/context";
import type { AccountStatus, Credential, User } from "../../../../src/server/api/domain";
import { ApiError } from "../../../../src/server/api/errors";
import { MemoryApiRepository } from "../../../../src/server/api/memory-repository";

describe("BETA-006 & BETA-007: Password Login, Session Renewal, Rotation & Expiry", () => {
  let repo: MemoryApiRepository;
  let apiContext: ReturnType<typeof createApiContext>;

  let addressIndex = 0;
  const defaultPassword = "SecurePassword!2026";

  async function seedTestUser(
    options: {
      userId?: string;
      email?: string;
      username?: string;
      password?: string;
      status?: AccountStatus;
    } = {},
  ) {
    addressIndex += 1;
    const char = String.fromCharCode(65 + (addressIndex % 26));
    const address = `G${char.repeat(55)}`;

    const userId = options.userId ?? `usr_test_${addressIndex}`;
    const email = options.email ?? `alice_${addressIndex}@stealth.mail`;
    const username = options.username ?? `alice_privacy_${addressIndex}`;
    const password = options.password ?? defaultPassword;
    const status = options.status ?? "active";

    const { hash, salt } = await hashPassword(password);
    const secretHash = `${hash}:${salt}`;

    const user: User = {
      userId,
      address,
      email,
      username,
      status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };

    const credential: Credential = {
      credentialId: `cred_${userId}`,
      userId,
      authMethod: "password_hash",
      secretHash,
      walletKeyRef: `vault_${userId}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await repo.createUser(user, credential);
    return { user, credential, password };
  }

  beforeEach(() => {
    repo = new MemoryApiRepository();
    apiContext = createApiContext(repo);
  });

  describe("Cookie Helpers", () => {
    it("parses stealth_session cookie from Cookie header", () => {
      const header = "theme=dark; stealth_session=sess_123456789; locale=en";
      expect(parseSessionCookie(header)).toBe("sess_123456789");
    });

    it("returns null when stealth_session cookie is absent", () => {
      expect(parseSessionCookie("theme=dark; locale=en")).toBeNull();
      expect(parseSessionCookie(null)).toBeNull();
    });

    it("builds valid HttpOnly, SameSite, Secure session cookie", () => {
      const cookie = buildSessionCookie("sess_abc", 3600, true);
      expect(cookie).toContain("stealth_session=sess_abc");
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("Secure");
      expect(cookie).toContain("SameSite=Lax");
    });

    it("builds clear session cookie", () => {
      const clearCookie = buildClearSessionCookie(true);
      expect(clearCookie).toContain("stealth_session=");
      expect(clearCookie).toContain("Max-Age=0");
    });
  });

  describe("authenticateWithPassword", () => {
    it("logs in successfully using valid email and password", async () => {
      await seedTestUser({
        email: "bob@stealth.mail",
        password: "MyPassword!1",
      });

      const result = await authenticateWithPassword(apiContext, {
        identifier: "bob@stealth.mail",
        password: "MyPassword!1",
        ip: "127.0.0.1",
        userAgent: "TestAgent/1.0",
      });

      expect(result.user.email).toBe("bob@stealth.mail");
      expect(result.session.sessionId).toMatch(/^sess_/);
      expect(result.session.userId).toBe(result.user.userId);
      expect(result.session.ipAddress).toBe("127.0.0.1");
      expect(result.session.absoluteExpiresAt).toBeDefined();
      expect(result.cookieHeader).toContain(`stealth_session=${result.session.sessionId}`);
    });

    it("logs in successfully using valid username and password", async () => {
      await seedTestUser({
        username: "charlie_stealth",
        password: "MyPassword!1",
      });

      const result = await authenticateWithPassword(apiContext, {
        identifier: "Charlie_Stealth", // test case-insensitivity
        password: "MyPassword!1",
      });

      expect(result.user.username).toBe("charlie_stealth");
      expect(result.session.sessionId).toBeDefined();
    });

    it("does not reveal whether an email exists on invalid password or missing user", async () => {
      await seedTestUser({ email: "exists@stealth.mail" });

      // Wrong password for existing user
      let errorExisting: ApiError | undefined;
      try {
        await authenticateWithPassword(apiContext, {
          identifier: "exists@stealth.mail",
          password: "WrongPassword!99",
        });
      } catch (err) {
        errorExisting = err as ApiError;
      }

      // Non-existent user
      let errorMissing: ApiError | undefined;
      try {
        await authenticateWithPassword(apiContext, {
          identifier: "nonexistent@stealth.mail",
          password: "WrongPassword!99",
        });
      } catch (err) {
        errorMissing = err as ApiError;
      }

      expect(errorExisting?.status).toBe(401);
      expect(errorExisting?.message).toBe("Invalid email/username or password");

      expect(errorMissing?.status).toBe(401);
      expect(errorMissing?.message).toBe("Invalid email/username or password");
    });

    it("enforces account status boundaries (pending_verification, suspended, deactivated)", async () => {
      await seedTestUser({
        userId: "usr_unverified",
        email: "unverified@stealth.mail",
        username: "unverified_usr",
        status: "pending_verification",
      });
      await seedTestUser({
        userId: "usr_suspended",
        email: "suspended@stealth.mail",
        username: "suspended_usr",
        status: "suspended",
      });
      await seedTestUser({
        userId: "usr_deactivated",
        email: "deactivated@stealth.mail",
        username: "deactivated_usr",
        status: "deactivated",
      });

      // Unverified account
      await expect(
        authenticateWithPassword(apiContext, {
          identifier: "unverified@stealth.mail",
          password: defaultPassword,
        }),
      ).rejects.toThrow("Account verification required");

      // Suspended account
      await expect(
        authenticateWithPassword(apiContext, {
          identifier: "suspended@stealth.mail",
          password: defaultPassword,
        }),
      ).rejects.toThrow("Account suspended");

      // Deactivated account
      await expect(
        authenticateWithPassword(apiContext, {
          identifier: "deactivated@stealth.mail",
          password: defaultPassword,
        }),
      ).rejects.toThrow("Account deactivated");
    });

    it("throttles login attempts after repeated failures", async () => {
      const identifier = "target@stealth.mail";
      await seedTestUser({ email: identifier });

      // Trigger MAX_LOGIN_ATTEMPTS failures
      for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i++) {
        await expect(
          authenticateWithPassword(apiContext, {
            identifier,
            password: "WrongPassword!",
          }),
        ).rejects.toThrow("Invalid email/username or password");
      }

      // Next attempt (even with correct password) should be throttled
      let throttledError: ApiError | undefined;
      try {
        await authenticateWithPassword(apiContext, {
          identifier,
          password: defaultPassword,
        });
      } catch (err) {
        throttledError = err as ApiError;
      }

      expect(throttledError?.status).toBe(429);
      expect(throttledError?.message).toBe("Too many login attempts. Please try again later");
    });

    it("prevents session fixation and rotates session identifiers", async () => {
      const { user } = await seedTestUser();

      // Initial login
      const firstLogin = await authenticateWithPassword(apiContext, {
        identifier: user.email,
        password: defaultPassword,
      });

      const oldSessionId = firstLogin.session.sessionId;
      expect(await repo.getSession(oldSessionId)).not.toBeNull();

      // Re-authenticate passing current session ID
      const secondLogin = await authenticateWithPassword(apiContext, {
        identifier: user.email,
        password: defaultPassword,
        currentSessionId: oldSessionId,
      });

      const newSessionId = secondLogin.session.sessionId;
      expect(newSessionId).not.toBe(oldSessionId);

      // Old session must be revoked
      expect(await repo.getSession(oldSessionId)).toBeNull();
      // New session must exist
      expect(await repo.getSession(newSessionId)).not.toBeNull();
      // Retired session record must exist
      expect(await repo.getRetiredSession(oldSessionId)).not.toBeNull();
    });
  });

  describe("validateSession & Expiry Boundaries", () => {
    it("validates an active session and extends sliding idle expiration window", async () => {
      let currentTime = new Date("2026-06-01T10:00:00.000Z");
      const { user } = await seedTestUser();

      const authResult = await authenticateWithPassword(
        apiContext,
        { identifier: user.email, password: defaultPassword },
        {
          now: () => currentTime,
          idleTtlSeconds: 1800,
          absoluteTtlSeconds: 86400,
        },
      );

      const initialExpiresAt = authResult.session.expiresAt;
      expect(initialExpiresAt).toBe(new Date("2026-06-01T10:30:00.000Z").toISOString());

      // Advance time by 10 minutes (within 30-min idle window)
      currentTime = new Date("2026-06-01T10:10:00.000Z");

      const validated = await validateSession(apiContext, authResult.session.sessionId, {
        now: () => currentTime,
        idleTtlSeconds: 1800,
      });

      expect(validated).not.toBeNull();
      expect(validated?.user.userId).toBe(user.userId);
      expect(validated?.session.lastActiveAt).toBe(currentTime.toISOString());
      // Sliding window should push expiresAt 30 minutes from current time (10:40)
      expect(validated?.session.expiresAt).toBe(new Date("2026-06-01T10:40:00.000Z").toISOString());
    });

    it("rejects and deletes session when idle timeout duration is exceeded", async () => {
      let currentTime = new Date("2026-06-01T10:00:00.000Z");
      const { user } = await seedTestUser();

      const authResult = await authenticateWithPassword(
        apiContext,
        { identifier: user.email, password: defaultPassword },
        { now: () => currentTime, idleTtlSeconds: 1800 },
      );

      // Advance time by 31 minutes (exceeds 30-min idle timeout)
      currentTime = new Date("2026-06-01T10:31:00.000Z");

      const validated = await validateSession(apiContext, authResult.session.sessionId, {
        now: () => currentTime,
        idleTtlSeconds: 1800,
      });

      expect(validated).toBeNull();
      expect(await repo.getSession(authResult.session.sessionId)).toBeNull();
    });

    it("enforces absolute lifetime expiry ceiling even with continuous activity", async () => {
      const startTime = new Date("2026-06-01T10:00:00.000Z");
      const { user } = await seedTestUser();

      // Set 1-hour absolute lifetime ceiling and 30-minute idle timeout
      const authResult = await authenticateWithPassword(
        apiContext,
        { identifier: user.email, password: defaultPassword },
        {
          now: () => startTime,
          idleTtlSeconds: 1800,
          absoluteTtlSeconds: 3600,
        },
      );

      // Validate at +20 minutes (extends idle to 10:50:00)
      const t1 = new Date("2026-06-01T10:20:00.000Z");
      const v1 = await validateSession(apiContext, authResult.session.sessionId, {
        now: () => t1,
        idleTtlSeconds: 1800,
      });

      expect(v1).not.toBeNull();
      expect(v1?.session.expiresAt).toBe(new Date("2026-06-01T10:50:00.000Z").toISOString());

      // Validate at +45 minutes (extends idle to 10:45+30m=11:15, but capped at absolute lifetime 11:00:00)
      const t2 = new Date("2026-06-01T10:45:00.000Z");
      const v2 = await validateSession(apiContext, authResult.session.sessionId, {
        now: () => t2,
        idleTtlSeconds: 1800,
      });

      expect(v2).not.toBeNull();
      expect(v2?.session.expiresAt).toBe(new Date("2026-06-01T11:00:00.000Z").toISOString());

      // Attempt validation at +61 minutes (exceeds 1-hour absolute lifetime ceiling)
      const t3 = new Date("2026-06-01T11:01:00.000Z");
      const v3 = await validateSession(apiContext, authResult.session.sessionId, {
        now: () => t3,
        idleTtlSeconds: 1800,
      });

      expect(v3).toBeNull();
      expect(await repo.getSession(authResult.session.sessionId)).toBeNull();
    });
  });

  describe("Session Renewal, Rotation & Theft Prevention", () => {
    it("renews session and rotates session identifier", async () => {
      const startTime = new Date("2026-06-01T10:00:00.000Z");
      const { user } = await seedTestUser();

      const authResult = await authenticateWithPassword(
        apiContext,
        { identifier: user.email, password: defaultPassword },
        { now: () => startTime },
      );

      const oldSessionId = authResult.session.sessionId;

      const renewTime = new Date("2026-06-01T10:15:00.000Z");
      const renewed = await renewSession(apiContext, oldSessionId, {
        now: () => renewTime,
      });

      expect(renewed.session.sessionId).not.toBe(oldSessionId);
      expect(renewed.session.rotatedFromSessionId).toBe(oldSessionId);
      expect(renewed.session.createdAt).toBe(authResult.session.createdAt);
      expect(renewed.cookieHeader).toContain(`stealth_session=${renewed.session.sessionId}`);

      // Old session ID removed from active sessions
      expect(await repo.getSession(oldSessionId)).toBeNull();
      // Old session ID preserved in retired sessions
      const retired = await repo.getRetiredSession(oldSessionId);
      expect(retired).not.toBeNull();
      expect(retired?.replacedBySessionId).toBe(renewed.session.sessionId);
    });

    it("resolves concurrent renewals deterministically within grace window", async () => {
      const startTime = new Date("2026-06-01T10:00:00.000Z");
      const { user } = await seedTestUser();

      const authResult = await authenticateWithPassword(
        apiContext,
        { identifier: user.email, password: defaultPassword },
        { now: () => startTime },
      );

      const oldSessionId = authResult.session.sessionId;

      // Request 1 rotates oldSessionId to newSessionId at 10:15:00
      const renewTime = new Date("2026-06-01T10:15:00.000Z");
      const renewed = await renewSession(apiContext, oldSessionId, {
        now: () => renewTime,
      });

      // Concurrent Request 2 arrives 2 seconds later (within 10s grace period) still using oldSessionId
      const concurrentTime = new Date("2026-06-01T10:15:02.000Z");
      const validatedConcurrent = await validateSession(apiContext, oldSessionId, {
        now: () => concurrentTime,
      });

      expect(validatedConcurrent).not.toBeNull();
      expect(validatedConcurrent?.session.sessionId).toBe(renewed.session.sessionId);
    });

    it("rejects stolen retired session reuse past grace window and revokes active session chain", async () => {
      const startTime = new Date("2026-06-01T10:00:00.000Z");
      const { user } = await seedTestUser();

      const authResult = await authenticateWithPassword(
        apiContext,
        { identifier: user.email, password: defaultPassword },
        { now: () => startTime },
      );

      const oldSessionId = authResult.session.sessionId;

      // Legitimate user renews session at 10:15:00
      const renewTime = new Date("2026-06-01T10:15:00.000Z");
      const renewed = await renewSession(apiContext, oldSessionId, {
        now: () => renewTime,
      });
      const newSessionId = renewed.session.sessionId;

      // Attacker attempts to reuse oldSessionId 30 seconds later (past 10s grace window)
      const attackerTime = new Date("2026-06-01T10:15:30.000Z");

      await expect(
        validateSession(apiContext, oldSessionId, { now: () => attackerTime }),
      ).rejects.toThrow("Retired session token reused");

      // Active session chain must be revoked to protect the user
      expect(await repo.getSession(newSessionId)).toBeNull();
    });

    it("revokes session on logout and emits privacy-safe audit event", async () => {
      const { user } = await seedTestUser();
      const authResult = await authenticateWithPassword(apiContext, {
        identifier: user.email,
        password: defaultPassword,
      });

      const spy = vi.spyOn(console, "info").mockImplementation(() => {});

      const logoutResult = await logoutSession(apiContext, authResult.session.sessionId, {
        host: "preview.stealth.mail:443",
      });

      expect(logoutResult.cookieHeader).toContain("Max-Age=0");
      const hasPreviewDomainCookie = logoutResult.cookieHeaders.some((h) =>
        h.includes("Domain=preview.stealth.mail"),
      );
      expect(hasPreviewDomainCookie).toBe(true);
      expect(await repo.getSession(authResult.session.sessionId)).toBeNull();

      expect(spy).toHaveBeenCalled();
      const auditLogRaw = spy.mock.calls.find((c) => c[0].includes('"action":"auth.logout"'))?.[0];
      expect(auditLogRaw).toBeDefined();

      const parsedAudit = JSON.parse(auditLogRaw!);
      expect(parsedAudit._audit).toBe(true);
      expect(parsedAudit.action).toBe("auth.logout");
      expect(parsedAudit.targetType).toBe("session");
      expect(parsedAudit.safeTargetReference).toMatch(/sess_/);
      expect(parsedAudit.result).toBe("success");

      // Verify absence of sensitive tokens/passwords
      expect(auditLogRaw).not.toContain(defaultPassword);
      expect(auditLogRaw).not.toContain("password");
      expect(auditLogRaw).not.toContain("secret");

      spy.mockRestore();
    });

    it("revokeAllSessions revokes all sessions for user and emits audit event", async () => {
      const { user } = await seedTestUser();

      const sess1 = await authenticateWithPassword(apiContext, {
        identifier: user.email,
        password: defaultPassword,
      });
      const sess2 = await authenticateWithPassword(apiContext, {
        identifier: user.email,
        password: defaultPassword,
      });

      expect(await repo.getSession(sess1.session.sessionId)).not.toBeNull();
      expect(await repo.getSession(sess2.session.sessionId)).not.toBeNull();

      const spy = vi.spyOn(console, "info").mockImplementation(() => {});

      const revokeResult = await revokeAllSessions(apiContext, user.userId, {
        host: "app.stealth.mail",
      });

      expect(revokeResult.cookieHeader).toContain("Max-Age=0");
      const hasDomainCookie = revokeResult.cookieHeaders.some((h) =>
        h.includes("Domain=app.stealth.mail"),
      );
      expect(hasDomainCookie).toBe(true);

      // Both sessions must be deleted from repository
      expect(await repo.getSession(sess1.session.sessionId)).toBeNull();
      expect(await repo.getSession(sess2.session.sessionId)).toBeNull();

      expect(spy).toHaveBeenCalled();
      const auditLogRaw = spy.mock.calls.find((c) =>
        c[0].includes('"action":"auth.logout_all"'),
      )?.[0];
      expect(auditLogRaw).toBeDefined();

      const parsedAudit = JSON.parse(auditLogRaw!);
      expect(parsedAudit._audit).toBe(true);
      expect(parsedAudit.action).toBe("auth.logout_all");
      expect(parsedAudit.actor).toBe(user.userId);
      expect(parsedAudit.targetType).toBe("account_sessions");
      expect(parsedAudit.safeTargetReference).toBe(user.userId);
      expect(parsedAudit.result).toBe("success");

      spy.mockRestore();
    });
  });
});
