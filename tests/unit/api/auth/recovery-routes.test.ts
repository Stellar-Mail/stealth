import { beforeEach, describe, expect, it } from "vitest";

import { Route as LoginRoute } from "../../../../src/routes/api/v1/auth/login";
import { Route as RedeemRoute } from "../../../../src/routes/api/v1/auth/recovery/redeem";
import { Route as RegenerateRoute } from "../../../../src/routes/api/v1/auth/recovery/regenerate";
import { Route as StatusRoute } from "../../../../src/routes/api/v1/auth/recovery/status";
import { hashPassword } from "../../../../src/server/api/auth/password";
import type { Credential, Session, User } from "../../../../src/server/api/domain";
import { MemoryApiRepository } from "../../../../src/server/api/memory-repository";

describe("BETA-010: Recovery API Routes (/api/v1/auth/recovery/*)", () => {
  let repo: MemoryApiRepository;
  const validStellarAddress = `G${"A".repeat(55)}`;
  const testPassword = "Password123!";

  beforeEach(async () => {
    repo = new MemoryApiRepository();
    (globalThis as any).__stealthApiRepository = repo;

    const { hash, salt } = await hashPassword(testPassword);
    const user: User = {
      userId: "usr_recovery_route",
      address: validStellarAddress,
      email: "recovery_route@stealth.mail",
      username: "recovery_route",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };
    const credential: Credential = {
      credentialId: "cred_recovery_route",
      userId: "usr_recovery_route",
      authMethod: "password_hash",
      secretHash: `${hash}:${salt}`,
      walletKeyRef: "vault_ref",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await repo.createUser(user, credential);
  });

  async function login(): Promise<string> {
    const handler = (LoginRoute.options.server?.handlers as any).POST;
    const loginResponse = await handler({
      request: new Request("https://stealth.mail/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: "recovery_route@stealth.mail",
          password: testPassword,
        }),
      }),
    });
    expect(loginResponse.status).toBe(200);
    return loginResponse.headers.get("Set-Cookie")!.split(";")[0];
  }

  function cookieHeaderFor(sessionId: string): string {
    return `stealth_session=${sessionId}`;
  }

  async function seedStaleSession(): Promise<string> {
    const session: Session = {
      sessionId: "sess_stale_route",
      userId: "usr_recovery_route",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      lastActiveAt: new Date().toISOString(),
      ipAddress: null,
      userAgent: null,
      deviceFingerprint: null,
    };
    await repo.createSession(session);
    return session.sessionId;
  }

  it("GET status without a session cookie is 401", async () => {
    const handler = (StatusRoute.options.server?.handlers as any).GET;
    const response = await handler({
      request: new Request("https://stealth.mail/api/v1/auth/recovery/status"),
    });
    expect(response.status).toBe(401);
  });

  it("GET status reports 'none' before any set exists", async () => {
    const cookie = await login();
    const handler = (StatusRoute.options.server?.handlers as any).GET;
    const response = await handler({
      request: new Request("https://stealth.mail/api/v1/auth/recovery/status", {
        headers: { Cookie: cookie },
      }),
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data).toEqual({
      status: "none",
      totalCodes: 0,
      remainingCodes: 0,
      generatedAt: null,
    });
  });

  it("POST regenerate requires a session cookie", async () => {
    const handler = (RegenerateRoute.options.server?.handlers as any).POST;
    const response = await handler({
      request: new Request("https://stealth.mail/api/v1/auth/recovery/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
    });
    expect(response.status).toBe(401);
  });

  it("regenerate returns codes once, then redeem consumes exactly one", async () => {
    const cookie = await login();

    const regenHandler = (RegenerateRoute.options.server?.handlers as any).POST;
    const regenResponse = await regenHandler({
      request: new Request("https://stealth.mail/api/v1/auth/recovery/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: "{}",
      }),
    });
    expect(regenResponse.status).toBe(200);
    const regenData = await regenResponse.json();
    expect(regenData.data.codes).toHaveLength(10);
    expect(regenData.data.status).toBe("active");
    expect(regenData.data.remainingCodes).toBe(10);

    const firstCode = regenData.data.codes[0] as string;

    // GET status shows one code consumed after redemption.
    const redeemHandler = (RedeemRoute.options.server?.handlers as any).POST;
    const redeemResponse = await redeemHandler({
      request: new Request("https://stealth.mail/api/v1/auth/recovery/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: "recovery_route@stealth.mail",
          code: firstCode,
        }),
      }),
    });
    expect(redeemResponse.status).toBe(200);
    const redeemData = await redeemResponse.json();
    expect(redeemData.data.session.sessionId).toBeDefined();
    const newCookie = redeemResponse.headers.get("Set-Cookie")!;
    expect(newCookie).toContain("stealth_session=");
    expect(newCookie).toContain("HttpOnly");

    const statusHandler = (StatusRoute.options.server?.handlers as any).GET;
    const statusResponse = await statusHandler({
      request: new Request("https://stealth.mail/api/v1/auth/recovery/status", {
        headers: { Cookie: newCookie.split(";")[0] },
      }),
    });
    const statusData = await statusResponse.json();
    expect(statusData.data.remainingCodes).toBe(9);
  });

  it("regenerate denies sessions without a recent login (403)", async () => {
    const staleCookie = cookieHeaderFor(await seedStaleSession());
    const handler = (RegenerateRoute.options.server?.handlers as any).POST;
    const response = await handler({
      request: new Request("https://stealth.mail/api/v1/auth/recovery/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: staleCookie },
        body: "{}",
      }),
    });
    expect(response.status).toBe(403);
  });

  it("redeem fails with 401 for an invalid code", async () => {
    const handler = (RedeemRoute.options.server?.handlers as any).POST;
    const response = await handler({
      request: new Request("https://stealth.mail/api/v1/auth/recovery/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: "recovery_route@stealth.mail",
          code: "AAAA-BBBB-CCCC-DDDD",
        }),
      }),
    });
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error.message).toBe("Invalid or already used recovery code");
  });

  it("redeem rejects malformed payloads with 422", async () => {
    const handler = (RedeemRoute.options.server?.handlers as any).POST;
    const response = await handler({
      request: new Request("https://stealth.mail/api/v1/auth/recovery/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "AAAA-BBBB-CCCC-DDDD" }),
      }),
    });
    expect(response.status).toBe(422);
  });

  it("redeem is idempotent under a repeated x-idempotency-key", async () => {
    const cookie = await login();
    const regenHandler = (RegenerateRoute.options.server?.handlers as any).POST;
    const regenResponse = await regenHandler({
      request: new Request("https://stealth.mail/api/v1/auth/recovery/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: "{}",
      }),
    });
    const { codes } = await regenResponse.json().then((d: any) => d.data);

    const handler = (RedeemRoute.options.server?.handlers as any).POST;
    const makeRequest = (idempotencyKey: string) =>
      new Request("https://stealth.mail/api/v1/auth/recovery/redeem", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({
          identifier: "recovery_route@stealth.mail",
          code: codes[0],
        }),
      });

    const first = await handler({ request: makeRequest("recovery-redeem-key-1") });
    expect(first.status).toBe(200);
    const newCookie = first.headers.get("Set-Cookie")!;
    expect(newCookie).toContain("stealth_session=");

    const replay = await handler({ request: makeRequest("recovery-redeem-key-1") });
    expect(replay.status).toBe(200);
    expect(replay.headers.get("x-idempotency-replayed")).toBe("true");
    expect(replay.headers.get("Set-Cookie")).toBeNull();

    // The code was consumed exactly once: the recovered session (from the
    // first response) sees exactly one code missing from the set.
    const statusHandler = (StatusRoute.options.server?.handlers as any).GET;
    const statusResponse = await statusHandler({
      request: new Request("https://stealth.mail/api/v1/auth/recovery/status", {
        headers: { Cookie: newCookie.split(";")[0] },
      }),
    });
    expect(statusResponse.status).toBe(200);
    const statusData = await statusResponse.json();
    expect(statusData.data.remainingCodes).toBe(9);
  });
});
