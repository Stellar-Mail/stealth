import { beforeEach, describe, expect, it } from "vitest";

import { Route as DeleteSessionRoute } from "../../../../src/routes/api/v1/auth/sessions/$sessionId";
import { Route as ListSessionsRoute } from "../../../../src/routes/api/v1/auth/sessions/index";
import { Route as RevokeOthersRoute } from "../../../../src/routes/api/v1/auth/sessions/revoke-others";
import { hashPassword } from "../../../../src/server/api/auth/password";
import { buildSessionCookie } from "../../../../src/server/api/auth/session-service";
import type { Credential, Session, User } from "../../../../src/server/api/domain";
import { MemoryApiRepository } from "../../../../src/server/api/memory-repository";

describe("BETA-022: Active Sessions & Account Security API Routes (/api/v1/auth/sessions/*)", () => {
  let repo: MemoryApiRepository;
  const validStellarAddress = `G${"A".repeat(55)}`;
  const otherStellarAddress = `G${"B".repeat(55)}`;
  const testPassword = "Password123!";

  const user1: User = {
    userId: "usr_session_test_1",
    address: validStellarAddress,
    email: "user1@stealth.mail",
    username: "user1",
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
  };

  const user2: User = {
    userId: "usr_session_test_2",
    address: otherStellarAddress,
    email: "user2@stealth.mail",
    username: "user2",
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
  };

  let session1_current: Session;
  let session1_other: Session;
  let session2_other: Session;

  beforeEach(async () => {
    repo = new MemoryApiRepository();
    (globalThis as any).__stealthApiRepository = repo;

    const { hash, salt } = await hashPassword(testPassword);
    const cred1: Credential = {
      credentialId: "cred_test_1",
      userId: user1.userId,
      authMethod: "password_hash",
      secretHash: `${hash}:${salt}`,
      walletKeyRef: "vault_ref_1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await repo.createUser(user1, cred1);

    const cred2: Credential = {
      credentialId: "cred_test_2",
      userId: user2.userId,
      authMethod: "password_hash",
      secretHash: `${hash}:${salt}`,
      walletKeyRef: "vault_ref_2",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await repo.createUser(user2, cred2);

    const now = new Date();
    const future = new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString();

    session1_current = {
      sessionId: "sess_user1_current",
      userId: user1.userId,
      createdAt: now.toISOString(),
      lastActiveAt: now.toISOString(),
      expiresAt: future,
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      ipAddress: "127.0.0.1",
      deviceFingerprint: "fp_secret_raw_123",
    };

    session1_other = {
      sessionId: "sess_user1_mobile",
      userId: user1.userId,
      createdAt: new Date(now.getTime() - 3600 * 1000).toISOString(),
      lastActiveAt: new Date(now.getTime() - 1800 * 1000).toISOString(),
      expiresAt: future,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1",
      ipAddress: "198.51.100.42",
      deviceFingerprint: "fp_secret_raw_456",
    };

    session2_other = {
      sessionId: "sess_user2_current",
      userId: user2.userId,
      createdAt: now.toISOString(),
      lastActiveAt: now.toISOString(),
      expiresAt: future,
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      ipAddress: "203.0.113.10",
      deviceFingerprint: "fp_secret_raw_789",
    };

    await repo.createSession(session1_current);
    await repo.createSession(session1_other);
    await repo.createSession(session2_other);
  });

  describe("GET /api/v1/auth/sessions", () => {
    it("returns 401 when no session cookie is provided", async () => {
      const handler = (ListSessionsRoute.options.server?.handlers as any).GET;
      const request = new Request("https://stealth.mail/api/v1/auth/sessions", {
        method: "GET",
      });

      const response = await handler({ request });
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error.code).toBe("unauthorized");
    });

    it("lists all active sessions for current user with device summary and region", async () => {
      const handler = (ListSessionsRoute.options.server?.handlers as any).GET;
      const cookie = buildSessionCookie(session1_current.sessionId);
      const request = new Request("https://stealth.mail/api/v1/auth/sessions", {
        method: "GET",
        headers: {
          cookie,
          "cf-ipcountry": "US",
        },
      });

      const response = await handler({ request });
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.data.sessions).toHaveLength(2);

      const current = json.data.sessions.find(
        (s: any) => s.sessionId === session1_current.sessionId,
      );
      expect(current).toBeDefined();
      expect(current.isCurrent).toBe(true);
      expect(current.deviceSummary).toBe("Chrome on macOS");
      expect(current.approximateRegion).toBe("US");

      const other = json.data.sessions.find((s: any) => s.sessionId === session1_other.sessionId);
      expect(other).toBeDefined();
      expect(other.isCurrent).toBe(false);
      expect(other.deviceSummary).toBe("Safari on iOS");

      // Verify NO raw IP address or sensitive device fingerprints are returned
      for (const s of json.data.sessions) {
        expect((s as any).ipAddress).toBeUndefined();
        expect((s as any).deviceFingerprint).toBeUndefined();
      }
    });

    it("auto-prunes expired sessions from the user's active session list", async () => {
      const expiredSession: Session = {
        sessionId: "sess_expired_1",
        userId: user1.userId,
        createdAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
        lastActiveAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
        expiresAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      };
      await repo.createSession(expiredSession);

      const handler = (ListSessionsRoute.options.server?.handlers as any).GET;
      const cookie = buildSessionCookie(session1_current.sessionId);
      const request = new Request("https://stealth.mail/api/v1/auth/sessions", {
        method: "GET",
        headers: { cookie },
      });

      const response = await handler({ request });
      expect(response.status).toBe(200);
      const json = await response.json();

      expect(json.data.sessions.some((s: any) => s.sessionId === expiredSession.sessionId)).toBe(
        false,
      );
      expect(await repo.getSession(expiredSession.sessionId)).toBeNull();
    });
  });

  describe("DELETE /api/v1/auth/sessions/$sessionId", () => {
    it("returns 401 when unauthenticated", async () => {
      const handler = (DeleteSessionRoute.options.server?.handlers as any).DELETE;
      const request = new Request("https://stealth.mail/api/v1/auth/sessions/sess_user1_mobile", {
        method: "DELETE",
      });

      const response = await handler({ request, params: { sessionId: "sess_user1_mobile" } });
      expect(response.status).toBe(401);
    });

    it("returns 404 when revoking a session that belongs to another user (isolation)", async () => {
      const handler = (DeleteSessionRoute.options.server?.handlers as any).DELETE;
      const cookie = buildSessionCookie(session1_current.sessionId);
      const request = new Request(
        `https://stealth.mail/api/v1/auth/sessions/${session2_other.sessionId}`,
        {
          method: "DELETE",
          headers: { cookie },
        },
      );

      const response = await handler({
        request,
        params: { sessionId: session2_other.sessionId },
      });
      expect(response.status).toBe(404);
      expect(await repo.getSession(session2_other.sessionId)).not.toBeNull();
    });

    it("successfully revokes another active session of the user", async () => {
      const handler = (DeleteSessionRoute.options.server?.handlers as any).DELETE;
      const cookie = buildSessionCookie(session1_current.sessionId);
      const request = new Request(
        `https://stealth.mail/api/v1/auth/sessions/${session1_other.sessionId}`,
        {
          method: "DELETE",
          headers: { cookie },
        },
      );

      const response = await handler({
        request,
        params: { sessionId: session1_other.sessionId },
      });
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.success).toBe(true);
      expect(json.data.revokedSessionId).toBe(session1_other.sessionId);
      expect(json.data.selfRevoked).toBe(false);

      expect(await repo.getSession(session1_other.sessionId)).toBeNull();
      expect(await repo.getSession(session1_current.sessionId)).not.toBeNull();
    });

    it("successfully revokes the current session (self-revocation) and sends clear cookies", async () => {
      const handler = (DeleteSessionRoute.options.server?.handlers as any).DELETE;
      const cookie = buildSessionCookie(session1_current.sessionId);
      const request = new Request(
        `https://stealth.mail/api/v1/auth/sessions/${session1_current.sessionId}`,
        {
          method: "DELETE",
          headers: { cookie },
        },
      );

      const response = await handler({
        request,
        params: { sessionId: session1_current.sessionId },
      });
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.success).toBe(true);
      expect(json.data.selfRevoked).toBe(true);

      const setCookie = response.headers.get("Set-Cookie");
      expect(setCookie).toBeDefined();
      expect(setCookie).toContain("Max-Age=0");
      expect(await repo.getSession(session1_current.sessionId)).toBeNull();
    });
  });

  describe("POST /api/v1/auth/sessions/revoke-others", () => {
    it("returns 401 when unauthenticated", async () => {
      const handler = (RevokeOthersRoute.options.server?.handlers as any).POST;
      const request = new Request("https://stealth.mail/api/v1/auth/sessions/revoke-others", {
        method: "POST",
      });

      const response = await handler({ request });
      expect(response.status).toBe(401);
    });

    it("revokes all sessions of user except the current one", async () => {
      const handler = (RevokeOthersRoute.options.server?.handlers as any).POST;
      const cookie = buildSessionCookie(session1_current.sessionId);
      const request = new Request("https://stealth.mail/api/v1/auth/sessions/revoke-others", {
        method: "POST",
        headers: { cookie },
      });

      const response = await handler({ request });
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.success).toBe(true);
      expect(json.data.revokedCount).toBe(1);

      expect(await repo.getSession(session1_other.sessionId)).toBeNull();
      expect(await repo.getSession(session1_current.sessionId)).not.toBeNull();
      // User 2's session must remain untouched
      expect(await repo.getSession(session2_other.sessionId)).not.toBeNull();
    });
  });
});
