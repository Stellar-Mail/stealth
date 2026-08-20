import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearBootstrapCache,
  fetchBootstrap,
  getCachedBootstrap,
} from "@/features/identity/bootstrap";

describe("Client Bootstrap Layer", () => {
  beforeEach(() => {
    clearBootstrapCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearBootstrapCache();
  });

  it("returns unauthorized state on 401 response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: "unauthorized" } }), { status: 401 }),
    );

    const state = await fetchBootstrap({ bypassCache: true });
    expect(state.branch).toBe("unauthorized");
    expect(state.error?.code).toBe("unauthorized");
    expect(state.data).toBeNull();
  });

  it("deduplicates concurrent in-flight fetchBootstrap requests", async () => {
    let fetchCount = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      fetchCount++;
      await new Promise((resolve) => setTimeout(resolve, 50));
      return new Response(
        JSON.stringify({
          data: {
            user: {
              userId: "user_123",
              username: "dedupuser",
              displayName: "Dedup User",
              email: "dedup@stealth.mail",
              accountStatus: "active",
              createdAt: new Date().toISOString(),
            },
            session: {
              sessionId: "sess_123",
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
            },
            address: "user_123",
            provisioning: null,
            policy: null,
            wallet: {
              connected: true,
              address: "user_123",
              signerType: "managed",
              capabilities: ["sign", "send", "read"],
              network: "testnet",
              balanceXlm: "100.0000000",
            },
            health: {
              ready: true,
              status: "ok",
              dependencies: { bindings: "ok" },
            },
            syncCursor: "sync_1",
            featureFlags: { liveMailboxSync: true },
            branch: "active",
          },
        }),
        { status: 200 },
      );
    });

    const [res1, res2] = await Promise.all([
      fetchBootstrap({ bypassCache: true }),
      fetchBootstrap({ bypassCache: true }),
    ]);

    expect(fetchCount).toBe(1);
    expect(res1).toBe(res2);
    expect(res1.branch).toBe("active");
  });

  it("returns cached bootstrap if requested within TTL", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            user: {
              userId: "user_456",
              username: "cacheduser",
              displayName: "Cached User",
              email: "cached@stealth.mail",
              accountStatus: "active",
              createdAt: new Date().toISOString(),
            },
            session: {
              sessionId: "sess_456",
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
            },
            address: "user_456",
            provisioning: null,
            policy: null,
            wallet: {
              connected: true,
              address: "user_456",
              signerType: "managed",
              capabilities: ["sign", "send", "read"],
              network: "testnet",
              balanceXlm: "50.0000000",
            },
            health: {
              ready: true,
              status: "ok",
              dependencies: { bindings: "ok" },
            },
            syncCursor: "sync_2",
            featureFlags: {},
            branch: "active",
          },
        }),
        { status: 200 },
      ),
    );

    const first = await fetchBootstrap({ bypassCache: true });
    expect(getCachedBootstrap()).toBe(first);

    const second = await fetchBootstrap({ bypassCache: false });
    expect(second).toBe(first);
  });

  it("clears cached state when clearBootstrapCache is invoked", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            user: {
              userId: "user_789",
              username: "cleareduser",
              displayName: "Cleared User",
              email: "cleared@stealth.mail",
              accountStatus: "active",
              createdAt: new Date().toISOString(),
            },
            session: {
              sessionId: "sess_789",
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
            },
            address: "user_789",
            provisioning: null,
            policy: null,
            wallet: {
              connected: true,
              address: "user_789",
              signerType: "managed",
              capabilities: ["sign"],
              network: "testnet",
              balanceXlm: "10.0000000",
            },
            health: {
              ready: true,
              status: "ok",
              dependencies: { bindings: "ok" },
            },
            syncCursor: "sync_3",
            featureFlags: {},
            branch: "active",
          },
        }),
        { status: 200 },
      ),
    );

    await fetchBootstrap({ bypassCache: true });
    expect(getCachedBootstrap()).not.toBeNull();

    clearBootstrapCache();
    expect(getCachedBootstrap()).toBeNull();
  });
});
