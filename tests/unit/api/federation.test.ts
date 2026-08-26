import { beforeEach, describe, expect, it } from "vitest";
import { Route as FederationRoute } from "../../../src/routes/api/v1/federation";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import type { User } from "../../../src/server/api/domain";
import serverEntry from "../../../src/server";

describe("BETA-090: Stellar Federation (SEP-2) & Root Redirects / TOML", () => {
  let repository: MemoryApiRepository;

  const ALICE_USER: User = {
    userId: "usr_alice123",
    address: "GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJGU7XYBNBNQ2LMCAKLKZ6DXAA",
    email: "alice@stealth.me",
    username: "alice",
    status: "active",
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const BOB_SUSPENDED: User = {
    userId: "usr_bob123",
    address: "GAYOLLLVPWNOY2R572622UGLM2F2D72VFU7GY3QMR44QW277U7H353PPA",
    email: "bob@stealth.me",
    username: "bob",
    status: "suspended",
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    repository = new MemoryApiRepository();
    (globalThis as any).__stealthApiRepository = repository;

    await repository.createUser(ALICE_USER);
    await repository.setProfile({
      userId: ALICE_USER.userId,
      username: ALICE_USER.username,
      displayName: "Alice Smith",
      avatarUrl: null,
      bio: null,
      locale: "en-US",
      timezone: "UTC",
      addressDisplay: "full" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await repository.setPolicy(ALICE_USER.address, {
      allowUnknown: true,
      requireVerified: false,
      minimumPostage: "0",
    });

    await repository.createUser(BOB_SUSPENDED);
  });

  describe("1. Federation Route (/api/v1/federation)", () => {
    it("GET type=name resolves active local username handle to account ID", async () => {
      const handler = (FederationRoute.options.server?.handlers as any).GET;
      const request = new Request(
        "https://app.stealth.me/api/v1/federation?type=name&q=alice*stealth.me",
      );

      const response = await handler({ request });
      expect(response.status).toBe(200);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");

      const body = await response.json();
      expect(body.data).toEqual({
        stellar_address: "alice*stealth.me",
        account_id: ALICE_USER.address,
      });
    });

    it("GET type=id resolves G-address back to active user's federation handle", async () => {
      const handler = (FederationRoute.options.server?.handlers as any).GET;
      const request = new Request(
        `https://app.stealth.me/api/v1/federation?type=id&q=${ALICE_USER.address}`,
      );

      const response = await handler({ request });
      expect(response.status).toBe(200);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");

      const body = await response.json();
      expect(body.data).toEqual({
        stellar_address: "alice*stealth.me",
        account_id: ALICE_USER.address,
      });
    });

    it("GET returns 404 for suspended or inactive accounts", async () => {
      const handler = (FederationRoute.options.server?.handlers as any).GET;
      const request = new Request(
        "https://app.stealth.me/api/v1/federation?type=name&q=bob*stealth.me",
      );

      const response = await handler({ request });
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error.code).toBe("not_found");
    });

    it("GET returns 404 for nonexistent handles", async () => {
      const handler = (FederationRoute.options.server?.handlers as any).GET;
      const request = new Request(
        "https://app.stealth.me/api/v1/federation?type=name&q=nonexistent*stealth.me",
      );

      const response = await handler({ request });
      expect(response.status).toBe(404);
    });

    it("GET returns 400 for malformed parameters", async () => {
      const handler = (FederationRoute.options.server?.handlers as any).GET;
      const request = new Request(
        "https://app.stealth.me/api/v1/federation?type=invalid_type&q=alice*stealth.me",
      );

      const response = await handler({ request });
      expect(response.status).toBe(400);
    });
  });

  describe("2. Server Intercepts and Redirects (src/server.ts)", () => {
    it("redirects HTTP requests to HTTPS in production environments", async () => {
      const request = new Request("http://app.stealth.me/inbox", {
        headers: {
          "x-forwarded-proto": "http",
          host: "app.stealth.me",
        },
      });

      const response = await serverEntry.fetch(request);
      expect(response.status).toBe(301);
      expect(response.headers.get("Location")).toBe("https://app.stealth.me/inbox");
    });

    it("redirects root domain calls to the app subdomain", async () => {
      const request = new Request("https://stealth.me/dashboard", {
        headers: {
          host: "stealth.me",
        },
      });

      const response = await serverEntry.fetch(request);
      expect(response.status).toBe(301);
      expect(response.headers.get("Location")).toBe("https://app.stealth.me/dashboard");
    });

    it("serves stellar.toml directly from root domain with dynamic federation server URL", async () => {
      const request = new Request("https://stealth.me/.well-known/stellar.toml", {
        headers: {
          host: "stealth.me",
        },
      });

      const response = await serverEntry.fetch(request);
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain("text/plain");
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");

      const text = await response.text();
      expect(text).toContain('FEDERATION_SERVER="https://app.stealth.me/api/v1/federation"');
    });

    it("serves stellar.toml dynamically with preview domain for staging environments", async () => {
      const request = new Request("https://app-preview.stealth.me/.well-known/stellar.toml", {
        headers: {
          host: "app-preview.stealth.me",
        },
      });

      const response = await serverEntry.fetch(request);
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain(
        'FEDERATION_SERVER="https://app-preview.stealth.me/api/v1/federation"',
      );
    });
  });
});
