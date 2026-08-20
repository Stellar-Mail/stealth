import { beforeEach, describe, expect, it } from "vitest";
import { Route as LoginRoute } from "../../../../src/routes/api/v1/auth/login";
import { Route as LogoutRoute } from "../../../../src/routes/api/v1/auth/logout";
import { Route as LogoutAllRoute } from "../../../../src/routes/api/v1/auth/logout-all";
import { Route as SessionRoute } from "../../../../src/routes/api/v1/auth/session";
import { hashPassword } from "../../../../src/server/api/auth/password";
import type { Credential, User } from "../../../../src/server/api/domain";
import { MemoryApiRepository } from "../../../../src/server/api/memory-repository";

describe("BETA-006: Auth API Routes (/api/v1/auth/*)", () => {
  let repo: MemoryApiRepository;
  const validStellarAddress = `G${"A".repeat(55)}`;
  const testPassword = "Password123!";

  beforeEach(async () => {
    repo = new MemoryApiRepository();
    (globalThis as any).__stealthApiRepository = repo;

    // Seed test user
    const { hash, salt } = await hashPassword(testPassword);
    const user: User = {
      userId: "usr_route_test",
      address: validStellarAddress,
      email: "route_user@stealth.mail",
      username: "route_user",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };
    const credential: Credential = {
      credentialId: "cred_route_test",
      userId: "usr_route_test",
      authMethod: "password_hash",
      secretHash: `${hash}:${salt}`,
      walletKeyRef: "vault_ref",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await repo.createUser(user, credential);
  });

  it("POST /api/v1/auth/login succeeds with valid credentials and sets Set-Cookie header", async () => {
    const handler = (LoginRoute.options.server?.handlers as any).POST;
    const request = new Request("https://stealth.mail/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: "route_user@stealth.mail",
        password: testPassword,
      }),
    });

    const response = await handler({ request });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.data.user.email).toBe("route_user@stealth.mail");
    expect(data.data.session.sessionId).toBeDefined();

    const setCookie = response.headers.get("Set-Cookie");
    expect(setCookie).toContain("stealth_session=");
    expect(setCookie).toContain("HttpOnly");
  });

  it("POST /api/v1/auth/login fails with 401 on invalid password", async () => {
    const handler = (LoginRoute.options.server?.handlers as any).POST;
    const request = new Request("https://stealth.mail/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: "route_user@stealth.mail",
        password: "WrongPassword!00",
      }),
    });

    const response = await handler({ request });
    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data.error.message).toBe("Invalid email/username or password");
  });

  it("GET /api/v1/auth/session returns user and session when cookie is valid", async () => {
    // Perform login first to acquire cookie
    const loginHandler = (LoginRoute.options.server?.handlers as any).POST;
    const loginRequest = new Request("https://stealth.mail/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: "route_user",
        password: testPassword,
      }),
    });
    const loginResponse = await loginHandler({ request: loginRequest });
    const cookieHeader = loginResponse.headers.get("Set-Cookie");

    // Extract cookie
    const cookieVal = cookieHeader?.split(";")[0];

    // Call session endpoint
    const sessionHandler = (SessionRoute.options.server?.handlers as any).GET;
    const sessionRequest = new Request("https://stealth.mail/api/v1/auth/session", {
      method: "GET",
      headers: { Cookie: cookieVal! },
    });

    const response = await sessionHandler({ request: sessionRequest });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.data.user.username).toBe("route_user");
    expect(data.data.session.sessionId).toBeDefined();
  });

  it("POST /api/v1/auth/logout revokes session and clears cookie", async () => {
    // Login first
    const loginHandler = (LoginRoute.options.server?.handlers as any).POST;
    const loginRequest = new Request("https://stealth.mail/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: "route_user",
        password: testPassword,
      }),
    });
    const loginResponse = await loginHandler({ request: loginRequest });
    const cookieHeader = loginResponse.headers.get("Set-Cookie");
    const cookieVal = cookieHeader?.split(";")[0];

    // Logout
    const logoutHandler = (LogoutRoute.options.server?.handlers as any).POST;
    const logoutRequest = new Request("https://stealth.mail/api/v1/auth/logout", {
      method: "POST",
      headers: { Cookie: cookieVal! },
    });

    const logoutResponse = await logoutHandler({ request: logoutRequest });
    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.headers.get("Set-Cookie")).toContain("Max-Age=0");

    // Session endpoint should now return 401
    const sessionHandler = (SessionRoute.options.server?.handlers as any).GET;
    const sessionRequest = new Request("https://stealth.mail/api/v1/auth/session", {
      method: "GET",
      headers: { Cookie: cookieVal! },
    });
    const sessionResponse = await sessionHandler({ request: sessionRequest });
    expect(sessionResponse.status).toBe(401);
  });

  it("POST /api/v1/auth/logout is idempotent on missing cookies and repeated calls", async () => {
    const logoutHandler = (LogoutRoute.options.server?.handlers as any).POST;

    // 1. Missing cookie
    const noCookieRequest = new Request("https://stealth.mail/api/v1/auth/logout", {
      method: "POST",
    });
    const noCookieResponse = await logoutHandler({ request: noCookieRequest });
    expect(noCookieResponse.status).toBe(200);
    expect(noCookieResponse.headers.get("Set-Cookie")).toContain("Max-Age=0");

    // 2. Login first
    const loginHandler = (LoginRoute.options.server?.handlers as any).POST;
    const loginRequest = new Request("https://stealth.mail/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: "route_user",
        password: testPassword,
      }),
    });
    const loginResponse = await loginHandler({ request: loginRequest });
    const cookieHeader = loginResponse.headers.get("Set-Cookie");
    const cookieVal = cookieHeader?.split(";")[0];

    // 3. First logout
    const logout1 = new Request("https://stealth.mail/api/v1/auth/logout", {
      method: "POST",
      headers: { Cookie: cookieVal! },
    });
    const res1 = await logoutHandler({ request: logout1 });
    expect(res1.status).toBe(200);

    // 4. Repeated logout with same cookie
    const logout2 = new Request("https://stealth.mail/api/v1/auth/logout", {
      method: "POST",
      headers: { Cookie: cookieVal! },
    });
    const res2 = await logoutHandler({ request: logout2 });
    expect(res2.status).toBe(200);
    expect(res2.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });

  it("POST /api/v1/auth/logout-all enforces authentication and revokes all active sessions", async () => {
    const logoutAllHandler = (LogoutAllRoute.options.server?.handlers as any).POST;
    const loginHandler = (LoginRoute.options.server?.handlers as any).POST;
    const sessionHandler = (SessionRoute.options.server?.handlers as any).GET;

    // 1. Unauthenticated call -> 401
    const unauthRequest = new Request("https://stealth.mail/api/v1/auth/logout-all", {
      method: "POST",
    });
    const unauthResponse = await logoutAllHandler({ request: unauthRequest });
    expect(unauthResponse.status).toBe(401);

    // 2. Create session A
    const loginReqA = new Request("https://stealth.mail/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "route_user", password: testPassword }),
    });
    const loginResA = await loginHandler({ request: loginReqA });
    const cookieA = (loginResA.headers.get("Set-Cookie") ?? "").split(";")[0];

    // 3. Create session B
    const loginReqB = new Request("https://stealth.mail/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "route_user", password: testPassword }),
    });
    const loginResB = await loginHandler({ request: loginReqB });
    const cookieB = (loginResB.headers.get("Set-Cookie") ?? "").split(";")[0];

    expect(cookieA).not.toBe(cookieB);

    // Verify both sessions are active
    const checkA1 = await sessionHandler({
      request: new Request("https://stealth.mail/api/v1/auth/session", {
        method: "GET",
        headers: { Cookie: cookieA },
      }),
    });
    expect(checkA1.status).toBe(200);

    const checkB1 = await sessionHandler({
      request: new Request("https://stealth.mail/api/v1/auth/session", {
        method: "GET",
        headers: { Cookie: cookieB },
      }),
    });
    expect(checkB1.status).toBe(200);

    // 4. Call logout-all using session A
    const logoutAllReq = new Request("https://stealth.mail/api/v1/auth/logout-all", {
      method: "POST",
      headers: { Cookie: cookieA },
    });
    const logoutAllRes = await logoutAllHandler({ request: logoutAllReq });
    expect(logoutAllRes.status).toBe(200);
    expect(logoutAllRes.headers.get("Set-Cookie")).toContain("Max-Age=0");

    // 5. Verify session A and session B both fail immediately with 401
    const checkA2 = await sessionHandler({
      request: new Request("https://stealth.mail/api/v1/auth/session", {
        method: "GET",
        headers: { Cookie: cookieA },
      }),
    });
    expect(checkA2.status).toBe(401);

    const checkB2 = await sessionHandler({
      request: new Request("https://stealth.mail/api/v1/auth/session", {
        method: "GET",
        headers: { Cookie: cookieB },
      }),
    });
    expect(checkB2.status).toBe(401);
  });

  it("handles race conditions during concurrent logout-all requests", async () => {
    const logoutAllHandler = (LogoutAllRoute.options.server?.handlers as any).POST;
    const loginHandler = (LoginRoute.options.server?.handlers as any).POST;

    // Create session
    const loginReq = new Request("https://stealth.mail/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "route_user", password: testPassword }),
    });
    const loginRes = await loginHandler({ request: loginReq });
    const cookie = (loginRes.headers.get("Set-Cookie") ?? "").split(";")[0];

    // Race two logout-all calls simultaneously
    const req1 = new Request("https://stealth.mail/api/v1/auth/logout-all", {
      method: "POST",
      headers: { Cookie: cookie },
    });
    const req2 = new Request("https://stealth.mail/api/v1/auth/logout-all", {
      method: "POST",
      headers: { Cookie: cookie },
    });

    const [res1, res2] = await Promise.all([
      logoutAllHandler({ request: req1 }),
      logoutAllHandler({ request: req2 }),
    ]);

    const statuses = [res1.status, res2.status];
    expect(statuses).toContain(200);
  });
});
