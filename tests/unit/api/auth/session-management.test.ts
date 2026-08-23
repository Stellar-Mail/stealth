import { beforeEach, describe, expect, it } from "vitest";

import { Route as ListSessionsRoute } from "../../../../src/routes/api/v1/auth/sessions/index";
import { Route as RevokeRoute } from "../../../../src/routes/api/v1/auth/sessions/revoke";
import { Route as RevokeOthersRoute } from "../../../../src/routes/api/v1/auth/sessions/revoke-others";
import { Route as LoginRoute } from "../../../../src/routes/api/v1/auth/login";

import {
  hashSessionId,
  parseUserAgent,
  getApproximateRegion,
  SESSION_COOKIE_NAME,
} from "../../../../src/server/api/auth/session-service";
import { hashPassword } from "../../../../src/server/api/auth/password";
import { createApiContext } from "../../../../src/server/api/context";
import type { Credential, Session, User } from "../../../../src/server/api/domain";
import { MemoryApiRepository } from "../../../../src/server/api/memory-repository";

describe("BETA-022: Active Session Management and Repository Operations", () => {
  let repo: MemoryApiRepository;
  let apiContext: ReturnType<typeof createApiContext>;

  const userId = "usr_alice";
  const otherUserId = "usr_bob";
  const testPassword = "aliceSecurePassword2026!";

  beforeEach(async () => {
    repo = new MemoryApiRepository();
    (globalThis as any).__stealthApiRepository = repo;
    apiContext = createApiContext(repo);

    // Seed alice
    const { hash, salt } = await hashPassword(testPassword);
    const user: User = {
      userId,
      address: `G${"A".repeat(55)}`,
      email: "alice@stealth.mail",
      username: "alice",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };
    const credential: Credential = {
      credentialId: `cred_${userId}`,
      userId,
      authMethod: "password_hash",
      secretHash: `${hash}:${salt}`,
      walletKeyRef: "vault_ref",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await repo.createUser(user, credential);
  });

  describe("Domain & Repository Session Operations", () => {
    it("correctly lists user sessions and isolates them by userId", async () => {
      const session1: Session = {
        sessionId: "sess_1",
        userId,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        lastActiveAt: new Date().toISOString(),
        absoluteExpiresAt: new Date(Date.now() + 3600000).toISOString(),
        ipAddress: "127.0.0.1",
        userAgent: "Mozilla/5.0 Chrome/120.0.0.0",
      };

      const session2: Session = {
        sessionId: "sess_2",
        userId,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        lastActiveAt: new Date().toISOString(),
        absoluteExpiresAt: new Date(Date.now() + 3600000).toISOString(),
        ipAddress: "8.8.8.8",
        userAgent: "Mozilla/5.0 Safari/605.1.15",
      };

      const bobSession: Session = {
        sessionId: "sess_bob",
        userId: otherUserId,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        lastActiveAt: new Date().toISOString(),
        absoluteExpiresAt: new Date(Date.now() + 3600000).toISOString(),
        ipAddress: "127.0.0.1",
        userAgent: "Mozilla/5.0 Firefox/120.0",
      };

      await repo.createSession(session1);
      await repo.createSession(session2);
      await repo.createSession(bobSession);

      const aliceSessions = await repo.listUserSessions(userId);
      expect(aliceSessions).toHaveLength(2);
      expect(aliceSessions.map((s) => s.sessionId)).toContain("sess_1");
      expect(aliceSessions.map((s) => s.sessionId)).toContain("sess_2");

      const bobSessions = await repo.listUserSessions(otherUserId);
      expect(bobSessions).toHaveLength(1);
      expect(bobSessions[0].sessionId).toBe("sess_bob");
    });

    it("correctly revokes other sessions while keeping the current session active", async () => {
      const session1: Session = {
        sessionId: "sess_1",
        userId,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        lastActiveAt: new Date().toISOString(),
      };

      const session2: Session = {
        sessionId: "sess_2",
        userId,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        lastActiveAt: new Date().toISOString(),
      };

      const bobSession: Session = {
        sessionId: "sess_bob",
        userId: otherUserId,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        lastActiveAt: new Date().toISOString(),
      };

      await repo.createSession(session1);
      await repo.createSession(session2);
      await repo.createSession(bobSession);

      await repo.deleteOtherUserSessions(userId, "sess_1");

      const aliceSessions = await repo.listUserSessions(userId);
      expect(aliceSessions).toHaveLength(1);
      expect(aliceSessions[0].sessionId).toBe("sess_1");

      // Bob's session should remain completely unaffected
      const bobSessions = await repo.listUserSessions(otherUserId);
      expect(bobSessions).toHaveLength(1);
    });
  });

  describe("Utility helpers", () => {
    it("hashes session ID securely with SHA-256", async () => {
      const hash1 = await hashSessionId("my-special-session-id");
      const hash2 = await hashSessionId("my-special-session-id");
      const hash3 = await hashSessionId("different-session-id");

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hash3);
      expect(hash1).toHaveLength(64); // hex representation of SHA-256
    });

    it("correctly parses user agents to friendly readable strings", () => {
      expect(
        parseUserAgent(
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        ),
      ).toBe("Chrome on macOS");
      expect(
        parseUserAgent(
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0",
        ),
      ).toBe("Firefox on Windows");
      expect(
        parseUserAgent(
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
        ),
      ).toBe("Safari on iOS");
      expect(
        parseUserAgent(
          "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/114.0.0.0 Mobile Safari/537.36",
        ),
      ).toBe("Chrome on Android");
      expect(parseUserAgent(null)).toBe("Unknown Device");
    });

    it("approximates regions based on IP address and anonymizes loopback", () => {
      expect(getApproximateRegion("127.0.0.1")).toBe("Local Network");
      expect(getApproximateRegion("::1")).toBe("Local Network");
      expect(getApproximateRegion("192.168.1.1")).toBe("Local Network");
      expect(getApproximateRegion("10.0.0.1")).toBe("Local Network");
      expect(getApproximateRegion("172.16.0.1")).toBe("Local Network");
      expect(getApproximateRegion("172.24.12.8")).toBe("Local Network");
      expect(getApproximateRegion("172.31.255.254")).toBe("Local Network");
      expect(getApproximateRegion("172.32.0.1")).not.toBe("Local Network");
      expect(getApproximateRegion(null)).toBe("Unknown Region");

      const region1 = getApproximateRegion("8.8.8.8");
      const region2 = getApproximateRegion("8.8.4.4");
      expect(region1).not.toBeNull();
      expect(region2).not.toBeNull();
    });
  });

  describe("API Endpoint Routes", () => {
    async function loginUserAndGetCookie(): Promise<string> {
      const handler = (LoginRoute.options.server?.handlers as any).POST;
      const request = new Request("https://stealth.mail/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: "alice@stealth.mail",
          password: testPassword,
        }),
      });

      const response = await handler({ request });
      expect(response.status).toBe(200);
      const cookieHeader = response.headers.get("Set-Cookie");
      expect(cookieHeader).toBeDefined();
      return cookieHeader!.split(";")[0];
    }

    it("GET /api/v1/auth/sessions returns listed active sessions", async () => {
      const cookie = await loginUserAndGetCookie();

      const handler = (ListSessionsRoute.options.server?.handlers as any).GET;
      const request = new Request("https://stealth.mail/api/v1/auth/sessions", {
        method: "GET",
        headers: { Cookie: cookie },
      });

      const response = await handler({ request });
      expect(response.status).toBe(200);

      const resJson = await response.json();
      expect(resJson.data).toHaveLength(1);
      expect(resJson.data[0].isCurrent).toBe(true);
      expect(resJson.data[0].id).toBeDefined();
    });

    it("POST /api/v1/auth/sessions/revoke revokes concurrent session successfully", async () => {
      const cookie = await loginUserAndGetCookie();

      // Let's manually inject another concurrent session for Alice in repository
      const session2: Session = {
        sessionId: "sess_concurrent",
        userId,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        lastActiveAt: new Date().toISOString(),
        absoluteExpiresAt: new Date(Date.now() + 3600000).toISOString(),
        recentLoginAt: new Date().toISOString(),
      };
      await repo.createSession(session2);

      const targetHash = await hashSessionId("sess_concurrent");

      const handler = (RevokeRoute.options.server?.handlers as any).POST;
      const request = new Request("https://stealth.mail/api/v1/auth/sessions/revoke", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
        },
        body: JSON.stringify({ id: targetHash }),
      });

      const response = await handler({ request });
      expect(response.status).toBe(200);

      const sessions = await repo.listUserSessions(userId);
      expect(sessions.map((s) => s.sessionId)).not.toContain("sess_concurrent");
    });

    it("POST /api/v1/auth/sessions/revoke triggers Set-Cookie to clear session on self-revocation", async () => {
      const cookie = await loginUserAndGetCookie();
      const currentSessionId = cookie.split("=")[1];
      const currentHash = await hashSessionId(currentSessionId);

      const handler = (RevokeRoute.options.server?.handlers as any).POST;
      const request = new Request("https://stealth.mail/api/v1/auth/sessions/revoke", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
        },
        body: JSON.stringify({ id: currentHash }),
      });

      const response = await handler({ request });
      expect(response.status).toBe(200);

      const setCookies = response.headers.getSetCookie();
      const cleared = setCookies.some(
        (c) => c.includes(`${SESSION_COOKIE_NAME}=;`) && c.includes("Max-Age=0"),
      );
      expect(cleared).toBe(true);

      const sessions = await repo.listUserSessions(userId);
      expect(sessions.map((s) => s.sessionId)).not.toContain(currentSessionId);
    });

    it("POST /api/v1/auth/sessions/revoke fails with 403 when recent-login window is exceeded", async () => {
      const cookie = await loginUserAndGetCookie();
      const currentSessionId = cookie.split("=")[1];

      // Mutate recentLoginAt to be older than 15 minutes
      const currentSession = await repo.getSession(currentSessionId);
      expect(currentSession).not.toBeNull();
      currentSession!.recentLoginAt = new Date(Date.now() - 20 * 60 * 1000).toISOString();
      await repo.updateSession(currentSession!);

      const currentHash = await hashSessionId(currentSessionId);

      const handler = (RevokeRoute.options.server?.handlers as any).POST;
      const request = new Request("https://stealth.mail/api/v1/auth/sessions/revoke", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
        },
        body: JSON.stringify({ id: currentHash }),
      });

      const response = await handler({ request });
      expect(response.status).toBe(403);

      const resJson = await response.json();
      expect(resJson.error.message).toContain("recent login");
    });

    it("POST /api/v1/auth/sessions/revoke-others revokes all concurrent sessions except current", async () => {
      const cookie = await loginUserAndGetCookie();
      const currentSessionId = cookie.split("=")[1];

      // Add two concurrent sessions
      await repo.createSession({
        sessionId: "sess_concurrent_1",
        userId,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        lastActiveAt: new Date().toISOString(),
      });
      await repo.createSession({
        sessionId: "sess_concurrent_2",
        userId,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        lastActiveAt: new Date().toISOString(),
      });

      const handler = (RevokeOthersRoute.options.server?.handlers as any).POST;
      const request = new Request("https://stealth.mail/api/v1/auth/sessions/revoke-others", {
        method: "POST",
        headers: { Cookie: cookie },
      });

      const response = await handler({ request });
      expect(response.status).toBe(200);

      const sessions = await repo.listUserSessions(userId);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].sessionId).toBe(currentSessionId);
    });

    it("GET /api/v1/auth/sessions returns 401 if no cookie is provided", async () => {
      const handler = (ListSessionsRoute.options.server?.handlers as any).GET;
      const request = new Request("https://stealth.mail/api/v1/auth/sessions", {
        method: "GET",
      });

      const response = await handler({ request });
      expect(response.status).toBe(401);
    });

    it("POST /api/v1/auth/sessions/revoke returns 404 if session hash is not found", async () => {
      const cookie = await loginUserAndGetCookie();

      const handler = (RevokeRoute.options.server?.handlers as any).POST;
      const request = new Request("https://stealth.mail/api/v1/auth/sessions/revoke", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
        },
        body: JSON.stringify({ id: "nonexistent_hash" }),
      });

      const response = await handler({ request });
      expect(response.status).toBe(404);
    });
  });
});
