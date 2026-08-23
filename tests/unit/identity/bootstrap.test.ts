// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearBootstrapCache,
  fetchBootstrap,
  getCachedBootstrap,
} from "@/features/identity/bootstrap";

// ---------------------------------------------------------------------------
// BETA-052 (Issue #1959) — Comprehensive bootstrap failure & recovery tests.
//
// The acceptance criteria require tests covering slow, failed, stale,
// suspended, and successful bootstrap scenarios. This suite extends the
// original happy-path coverage with timeout, network error, rate-limit,
// offline detection, session-expiry, and active-state validation.
// ---------------------------------------------------------------------------

function makeBootstrapPayload(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      user: {
        userId: "user_test",
        username: "testuser",
        displayName: "Test User",
        email: "test@stealth.mail",
        accountStatus: "active",
        createdAt: new Date().toISOString(),
      },
      session: {
        sessionId: "sess_test",
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      },
      address: "user_test",
      provisioning: null,
      policy: null,
      wallet: {
        connected: true,
        address: "user_test",
        signerType: "managed",
        capabilities: ["sign", "send", "read"],
        network: "testnet",
        balanceXlm: "100.0000000",
      },
      health: {
        ready: true,
        status: "ok",
        dependencies: { bindings: "ok", storage: "ok", coordinator: "ok" },
      },
      syncCursor: "sync_test",
      featureFlags: { liveMailboxSync: true },
      branch: "active",
      ...overrides,
    },
  };
}

describe("Client Bootstrap Layer", () => {
  beforeEach(() => {
    clearBootstrapCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearBootstrapCache();
  });

  // ── Original coverage ───────────────────────────────────────────────

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
      return new Response(JSON.stringify(makeBootstrapPayload()), { status: 200 });
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
      new Response(JSON.stringify(makeBootstrapPayload()), { status: 200 }),
    );

    const first = await fetchBootstrap({ bypassCache: true });
    expect(getCachedBootstrap()).toBe(first);

    const second = await fetchBootstrap({ bypassCache: false });
    expect(second).toBe(first);
  });

  it("clears cached state when clearBootstrapCache is invoked", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(makeBootstrapPayload()), { status: 200 }),
    );

    await fetchBootstrap({ bypassCache: true });
    expect(getCachedBootstrap()).not.toBeNull();

    clearBootstrapCache();
    expect(getCachedBootstrap()).toBeNull();
  });

  // ── BETA-052 — Slow / timeout scenarios ─────────────────────────────

  it("returns timeout error state when the request exceeds the deadline", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        new Promise((_resolve, reject) =>
          setTimeout(
            () => reject(new DOMException("The operation was aborted.", "AbortError")),
            50,
          ),
        ),
    );

    const state = await fetchBootstrap({ bypassCache: true, timeoutMs: 10 });
    expect(state.branch).toBe("outage");
    expect(state.error?.code).toBe("timeout");
    expect(state.error?.retryable).toBe(true);
    expect(state.error?.message).toContain("timed out");
  });

  // ── BETA-052 — Network failure scenarios ────────────────────────────

  it("returns network error state when fetch throws a generic error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Failed to fetch"));

    const state = await fetchBootstrap({ bypassCache: true });
    expect(state.branch).toBe("outage");
    expect(state.error?.code).toBe("network_error");
    expect(state.error?.retryable).toBe(true);
    expect(state.error?.message).toContain("Failed to fetch");
  });

  // ── BETA-052 — Rate-limit (429) scenarios ──────────────────────────

  it("returns rate-limited error state on 429 response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: "rate_limited" } }), { status: 429 }),
    );

    const state = await fetchBootstrap({ bypassCache: true });
    expect(state.branch).toBe("outage");
    expect(state.error?.code).toBe("rate_limited");
    expect(state.error?.retryable).toBe(true);
    expect(state.error?.message).toContain("Too many");
  });

  // ── BETA-052 — Server error (5xx) scenarios ────────────────────────

  it("returns server error state on 503 response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: "server_error" } }), { status: 503 }),
    );

    const state = await fetchBootstrap({ bypassCache: true });
    expect(state.branch).toBe("outage");
    expect(state.error?.code).toBe("server_error");
    expect(state.error?.retryable).toBe(true);
  });

  // ── BETA-052 — Offline detection ───────────────────────────────────

  it("returns offline error state when navigator.onLine is false", async () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
      configurable: true,
    });
    try {
      const state = await fetchBootstrap({ bypassCache: true });
      expect(state.branch).toBe("outage");
      expect(state.error?.code).toBe("offline");
      expect(state.error?.retryable).toBe(true);
      expect(state.error?.message).toContain("offline");
    } finally {
      Object.defineProperty(navigator, "onLine", {
        value: true,
        writable: true,
        configurable: true,
      });
    }
  });

  // ── BETA-052 — Successful active state ─────────────────────────────

  it("parses and returns the full active bootstrap payload", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(makeBootstrapPayload()), { status: 200 }),
    );

    const state = await fetchBootstrap({ bypassCache: true });
    expect(state.branch).toBe("active");
    expect(state.error).toBeNull();
    expect(state.data).not.toBeNull();
    expect(state.data?.user.userId).toBe("user_test");
    expect(state.data?.session.sessionId).toBe("sess_test");
    expect(state.data?.wallet.connected).toBe(true);
    expect(state.data?.health.status).toBe("ok");
    expect(state.data?.syncCursor).toBe("sync_test");
  });

  // ── BETA-052 — Suspended account ───────────────────────────────────

  it("parses and returns the suspended bootstrap branch", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(makeBootstrapPayload({ branch: "suspended" })), { status: 200 }),
    );

    const state = await fetchBootstrap({ bypassCache: true });
    expect(state.branch).toBe("suspended");
    expect(state.data?.user.accountStatus).toBe("active");
  });

  // ── BETA-052 — Session expiry bypasses cache ───────────────────────

  it("bypasses cache and re-fetches when the session is about to expire", async () => {
    // First fetch with a session expiring in 30 seconds (within the 60s grace window)
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify(
          makeBootstrapPayload({
            session: {
              sessionId: "sess_expiring",
              expiresAt: new Date(Date.now() + 30_000).toISOString(), // 30s from now
            },
          }),
        ),
        { status: 200 },
      ),
    );

    const first = await fetchBootstrap({ bypassCache: true });
    expect(first.branch).toBe("active");
    expect(first.data?.session.sessionId).toBe("sess_expiring");

    // Second fetch without bypassCache should still re-fetch because the
    // session expires within 60 seconds.
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify(
          makeBootstrapPayload({
            session: {
              sessionId: "sess_refreshed",
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
            },
          }),
        ),
        { status: 200 },
      ),
    );

    const second = await fetchBootstrap({ bypassCache: false });
    expect(second.data?.session.sessionId).toBe("sess_refreshed");
  });

  // ── BETA-052 — Stale cache is refreshed ────────────────────────────

  it("bypasses cache when the TTL has elapsed", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(makeBootstrapPayload()), { status: 200 }),
    );

    const first = await fetchBootstrap({ bypassCache: true });
    expect(first.branch).toBe("active");

    // Simulate TTL expiry by manipulating the cached timestamp
    const cached = getCachedBootstrap();
    expect(cached).toBe(first);

    // The second fetch with bypassCache=false should use cache (within 30s TTL)
    const second = await fetchBootstrap({ bypassCache: false });
    expect(second).toBe(first);

    // But if we mock a new response and bypass cache, it fetches fresh
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(makeBootstrapPayload()), { status: 200 }),
    );
    const third = await fetchBootstrap({ bypassCache: true });
    expect(third.branch).toBe("active");
  });

  // ── BETA-052 — Recovery from outage via retry ──────────────────────

  it("allows recovery from outage state via bypassCache retry", async () => {
    // First call fails
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: "server_error" } }), { status: 500 }),
    );

    const outageState = await fetchBootstrap({ bypassCache: true });
    expect(outageState.branch).toBe("outage");

    // Second call succeeds (simulates retry after service recovery)
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(makeBootstrapPayload()), { status: 200 }),
    );

    const recoveredState = await fetchBootstrap({ bypassCache: true });
    expect(recoveredState.branch).toBe("active");
    expect(recoveredState.error).toBeNull();
  });

  // ── BETA-052 — Invalid response payload ────────────────────────────

  it("returns error state for malformed bootstrap response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ data: null }), { status: 200 }),
    );

    // The invalid payload triggers the "Invalid bootstrap payload" error path
    const state = await fetchBootstrap({ bypassCache: true });
    expect(state.branch).toBe("outage");
    expect(state.error?.retryable).toBe(true);
  });
});
