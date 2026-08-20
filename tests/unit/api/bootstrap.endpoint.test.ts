import { beforeEach, describe, expect, it } from "vitest";

import { Route } from "@/routes/api/v1/bootstrap";
import { MemoryApiRepository } from "@/server/api/memory-repository";

const TEST_ADDRESS_1 = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const TEST_ADDRESS_2 = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const TEST_ADDRESS_3 = "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";

describe("GET /api/v1/bootstrap", () => {
  beforeEach(() => {
    delete (globalThis as any).__stealthApiRepository;
  });

  it("returns 401 unauthorized when no session cookie is provided", async () => {
    const request = new Request("http://localhost/api/v1/bootstrap", {
      method: "GET",
    });

    const handler = (Route.options.server as any).handlers.GET;
    const response = await handler({ request });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("unauthorized");
  });

  it("returns 401 unauthorized when session cookie is invalid", async () => {
    const request = new Request("http://localhost/api/v1/bootstrap", {
      method: "GET",
      headers: { Cookie: "stealth_session=invalid_session_token_123" },
    });

    const handler = (Route.options.server as any).handlers.GET;
    const response = await handler({ request });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("unauthorized");
  });

  it("returns active branch and full bootstrap data for authenticated user", async () => {
    const repository = new MemoryApiRepository();
    (globalThis as any).__stealthApiRepository = repository;

    const user = await repository.createUser({
      userId: "user_active_123",
      address: TEST_ADDRESS_1,
      username: "bootstrapuser",
      email: "bootstrap@stealth.mail",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    });

    const session = await repository.createSession({
      sessionId: "sess_active_123",
      userId: user.userId,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    const request = new Request("http://localhost/api/v1/bootstrap", {
      method: "GET",
      headers: { Cookie: `stealth_session=${session.sessionId}` },
    });

    const handler = (Route.options.server as any).handlers.GET;
    const response = await handler({ request });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.branch).toBe("active");
    expect(body.data.user.username).toBe("bootstrapuser");
    expect(body.data.user.email).toBe("bootstrap@stealth.mail");
    expect(body.data.wallet.connected).toBe(true);
    expect(body.data.health.ready).toBe(true);
  });

  it("returns onboarding branch when account status is pending_verification", async () => {
    const repository = new MemoryApiRepository();
    (globalThis as any).__stealthApiRepository = repository;

    const user = await repository.createUser({
      userId: "user_pending_123",
      address: TEST_ADDRESS_2,
      username: "pendinguser",
      email: "pending@stealth.mail",
      status: "pending_verification",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    });

    const session = await repository.createSession({
      sessionId: "sess_pending_123",
      userId: user.userId,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    const request = new Request("http://localhost/api/v1/bootstrap", {
      method: "GET",
      headers: { Cookie: `stealth_session=${session.sessionId}` },
    });

    const handler = (Route.options.server as any).handlers.GET;
    const response = await handler({ request });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.branch).toBe("onboarding");
  });

  it("returns suspended branch when account status is suspended", async () => {
    const repository = new MemoryApiRepository();
    (globalThis as any).__stealthApiRepository = repository;

    const user = await repository.createUser({
      userId: "user_suspended_123",
      address: TEST_ADDRESS_3,
      username: "suspendeduser",
      email: "suspended@stealth.mail",
      status: "suspended",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    });

    const session = await repository.createSession({
      sessionId: "sess_suspended_123",
      userId: user.userId,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    const request = new Request("http://localhost/api/v1/bootstrap", {
      method: "GET",
      headers: { Cookie: `stealth_session=${session.sessionId}` },
    });

    const handler = (Route.options.server as any).handlers.GET;
    const response = await handler({ request });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.branch).toBe("suspended");
  });
});
