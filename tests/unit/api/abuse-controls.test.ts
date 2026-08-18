/**
 * BETA-049: Abuse controls unit tests.
 *
 * Covers:
 * 1. Per-IP auth limits (login, register)
 * 2. Per-session relay submission quota
 * 3. Per-account storage byte budget
 * 4. Per-account chain-write budget
 * 5. IP normalization (anti-evasion)
 * 6. Operator override bypass
 * 7. Outage / fail-open / fail-closed policies for new routes
 * 8. False-positive tests: legitimate actors are never blocked prematurely
 * 9. Retry-after values in every rejection
 */
import { describe, expect, it, vi } from "vitest";

import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import * as metrics from "../../../src/server/api/metrics";
import {
  AUTH_IP_BUDGET,
  CHAIN_WRITE_BUDGET,
  RELAY_SESSION_BUDGET,
  STORAGE_BYTE_BUDGET,
  checkAuthIpLoginLimit,
  checkAuthIpRegisterLimit,
  checkChainWriteLimit,
  checkRelaySessionLimit,
  checkStorageByteBudget,
  normalizeIp,
  recordStorageBytes,
} from "../../../src/server/api/abuse-service";
import {
  enforceAuthLoginLimits,
  enforceAuthRegisterLimits,
  enforceChainWriteLimits,
  enforceDeviceLimit,
  enforceRelaySubmitLimits,
  enforceStorageFinalizeLimits,
  enforceStorageStageLimits,
  hasOperatorOverride,
} from "../../../src/server/api/abuse-controls";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STELLAR_ADDR_A = `G${"A".repeat(55)}`;
const STELLAR_ADDR_B = `G${"B".repeat(55)}`;
const TEST_IP = "203.0.113.1";
const TEST_SESSION = "sess_abc123";
const TEST_RELAY_ID = "relay-001";

function makeRequest(overrides: { headers?: Record<string, string> } = {}): Request {
  return new Request("https://test.stealth/api/v1/relay/messages", {
    method: "POST",
    headers: overrides.headers ?? {},
  });
}

function makeOperatorRequest(): Request {
  const token = "test-operator-token";
  const originalEnv = process.env.STEALTH_ABUSE_BYPASS_TOKEN;
  process.env.STEALTH_ABUSE_BYPASS_TOKEN = token;
  const req = makeRequest({ headers: { "x-stealth-operator-token": token } });
  // restore after
  if (originalEnv === undefined) {
    delete process.env.STEALTH_ABUSE_BYPASS_TOKEN;
  } else {
    process.env.STEALTH_ABUSE_BYPASS_TOKEN = originalEnv;
  }
  return req;
}

class FailingRepository extends MemoryApiRepository {
  constructor(private readonly method: "getCounter" | "incrementCounter") {
    super();
  }
  override async getCounter(key: string): Promise<number> {
    if (this.method === "getCounter") throw new Error(`read unavailable: ${key}`);
    return super.getCounter(key);
  }
  override async incrementCounter(
    key: string,
    windowSeconds: number,
    amount?: number,
  ): Promise<number> {
    if (this.method === "incrementCounter") throw new Error(`write unavailable: ${key}`);
    return super.incrementCounter(key, windowSeconds, amount);
  }
}

// ─── IP Normalization ─────────────────────────────────────────────────────────

describe("normalizeIp", () => {
  it("passes through a plain IPv4 address unchanged", () => {
    expect(normalizeIp("1.2.3.4")).toBe("1.2.3.4");
  });

  it("lowercases IPv6 addresses", () => {
    expect(normalizeIp("2001:DB8::1")).toBe("2001:db8::1");
  });

  it("unwraps IPv4-mapped IPv6 addresses", () => {
    expect(normalizeIp("::ffff:1.2.3.4")).toBe("1.2.3.4");
    expect(normalizeIp("::FFFF:1.2.3.4")).toBe("1.2.3.4");
  });

  it("returns unknown as-is", () => {
    expect(normalizeIp("unknown")).toBe("unknown");
    expect(normalizeIp("")).toBe("");
  });

  it("trims whitespace", () => {
    expect(normalizeIp("  1.2.3.4  ")).toBe("1.2.3.4");
  });

  it("prevents evasion via IPv4-mapped form hitting the same counter", async () => {
    const repo = new MemoryApiRepository();
    // Exhaust limit via mapped form
    for (let i = 0; i < AUTH_IP_BUDGET.login.max; i++) {
      await repo.incrementCounter(
        `abuse:auth_login:ip:1.2.3.4`,
        AUTH_IP_BUDGET.login.windowSeconds,
      );
    }
    // Same IP via plain IPv4 should also be blocked
    const result = await checkAuthIpLoginLimit(repo, "1.2.3.4");
    expect(result.allowed).toBe(false);
    // Mapped form resolves to same key
    const resultMapped = await checkAuthIpLoginLimit(repo, "::ffff:1.2.3.4");
    expect(resultMapped.allowed).toBe(false);
  });
});

// ─── Auth: login IP limit ─────────────────────────────────────────────────────

describe("checkAuthIpLoginLimit", () => {
  it("allows under the limit", async () => {
    const repo = new MemoryApiRepository();
    const result = await checkAuthIpLoginLimit(repo, TEST_IP);
    expect(result).toMatchObject({ allowed: true });
  });

  it("flags unknown IP but allows through", async () => {
    const repo = new MemoryApiRepository();
    const result = await checkAuthIpLoginLimit(repo, "unknown");
    expect(result).toMatchObject({ allowed: true, flagged: true });
  });

  it("blocks after login budget exhausted", async () => {
    const repo = new MemoryApiRepository();
    for (let i = 0; i < AUTH_IP_BUDGET.login.max; i++) {
      await repo.incrementCounter(
        `abuse:auth_login:ip:${TEST_IP}`,
        AUTH_IP_BUDGET.login.windowSeconds,
      );
    }
    const result = await checkAuthIpLoginLimit(repo, TEST_IP);
    expect(result).toMatchObject({ allowed: false });
    expect(result.retryAfterSeconds).toBe(AUTH_IP_BUDGET.login.windowSeconds);
  });

  it("login limit does not bleed into register limit (counter isolation)", async () => {
    const repo = new MemoryApiRepository();
    for (let i = 0; i < AUTH_IP_BUDGET.login.max; i++) {
      await repo.incrementCounter(
        `abuse:auth_login:ip:${TEST_IP}`,
        AUTH_IP_BUDGET.login.windowSeconds,
      );
    }
    const registerResult = await checkAuthIpRegisterLimit(repo, TEST_IP);
    expect(registerResult.allowed).toBe(true);
  });

  it("fails open and emits metrics when counter is unavailable (fail_open policy)", async () => {
    const repo = new FailingRepository("incrementCounter");
    const spy = vi.spyOn(metrics, "incrementCounter");
    try {
      const result = await checkAuthIpLoginLimit(repo, TEST_IP);
      expect(result).toMatchObject({ allowed: true, flagged: true });
      expect(spy).toHaveBeenCalledWith(
        "abuse_dependency_fallback",
        expect.objectContaining({ check: "ip", decision: "allow" }),
      );
    } finally {
      spy.mockRestore();
    }
  });
});

// ─── Auth: register IP limit ─────────────────────────────────────────────────

describe("checkAuthIpRegisterLimit", () => {
  it("allows under the limit", async () => {
    const repo = new MemoryApiRepository();
    const result = await checkAuthIpRegisterLimit(repo, TEST_IP);
    expect(result).toMatchObject({ allowed: true });
  });

  it("blocks after register budget exhausted", async () => {
    const repo = new MemoryApiRepository();
    for (let i = 0; i < AUTH_IP_BUDGET.register.max; i++) {
      await repo.incrementCounter(
        `abuse:auth_register:ip:${TEST_IP}`,
        AUTH_IP_BUDGET.register.windowSeconds,
      );
    }
    const result = await checkAuthIpRegisterLimit(repo, TEST_IP);
    expect(result).toMatchObject({ allowed: false });
    expect(result.retryAfterSeconds).toBe(AUTH_IP_BUDGET.register.windowSeconds);
  });

  it("fails closed and emits metrics when counter unavailable (fail_closed policy)", async () => {
    const repo = new FailingRepository("incrementCounter");
    const spy = vi.spyOn(metrics, "incrementCounter");
    try {
      const result = await checkAuthIpRegisterLimit(repo, TEST_IP);
      expect(result).toMatchObject({
        allowed: false,
        outage: { check: "ip", policy: "fail_closed", route: "auth_register" },
      });
      expect(spy).toHaveBeenCalledWith(
        "abuse_dependency_fallback",
        expect.objectContaining({ check: "ip", decision: "deny" }),
      );
    } finally {
      spy.mockRestore();
    }
  });
});

// ─── Relay: session quota ─────────────────────────────────────────────────────

describe("checkRelaySessionLimit", () => {
  it("allows under the session quota", async () => {
    const repo = new MemoryApiRepository();
    const result = await checkRelaySessionLimit(repo, TEST_SESSION);
    expect(result).toMatchObject({ allowed: true });
  });

  it("blocks after session relay quota exhausted", async () => {
    const repo = new MemoryApiRepository();
    for (let i = 0; i < RELAY_SESSION_BUDGET.max; i++) {
      await repo.incrementCounter(
        `abuse:relay:session:${TEST_SESSION}`,
        RELAY_SESSION_BUDGET.windowSeconds,
      );
    }
    const result = await checkRelaySessionLimit(repo, TEST_SESSION);
    expect(result).toMatchObject({ allowed: false });
    expect(result.retryAfterSeconds).toBe(RELAY_SESSION_BUDGET.windowSeconds);
  });

  it("session quotas are isolated per session ID", async () => {
    const repo = new MemoryApiRepository();
    for (let i = 0; i < RELAY_SESSION_BUDGET.max; i++) {
      await repo.incrementCounter(
        `abuse:relay:session:${TEST_SESSION}`,
        RELAY_SESSION_BUDGET.windowSeconds,
      );
    }
    const otherResult = await checkRelaySessionLimit(repo, "sess_other");
    expect(otherResult.allowed).toBe(true);
  });

  it("fails open on counter failure (session check is fail_open)", async () => {
    const repo = new FailingRepository("incrementCounter");
    const result = await checkRelaySessionLimit(repo, TEST_SESSION);
    expect(result).toMatchObject({ allowed: true, flagged: true });
  });
});

// ─── Storage: byte budget ─────────────────────────────────────────────────────

describe("checkStorageByteBudget", () => {
  it("allows under the byte budget", async () => {
    const repo = new MemoryApiRepository();
    const result = await checkStorageByteBudget(repo, STELLAR_ADDR_A, 1024);
    expect(result).toMatchObject({ allowed: true });
  });

  it("blocks when byte count would exceed budget", async () => {
    const repo = new MemoryApiRepository();
    // Use small values to keep the sliding-window counter manageable.
    // Record 99 bytes of the 100-byte test budget.
    await recordStorageBytes(repo, STELLAR_ADDR_A, 99);
    // Now try to stage 2 bytes against a 100-byte budget — should exceed
    const result = await checkStorageByteBudget(repo, STELLAR_ADDR_A, 2, "storage_stage", 100);
    expect(result).toMatchObject({ allowed: false });
    expect(result.retryAfterSeconds).toBe(STORAGE_BYTE_BUDGET.windowSeconds);
  });

  it("allows exactly the budget limit", async () => {
    const repo = new MemoryApiRepository();
    // Stage exactly 100 bytes against a 100-byte budget — should be allowed
    const result = await checkStorageByteBudget(repo, STELLAR_ADDR_A, 100, "storage_stage", 100);
    expect(result).toMatchObject({ allowed: true });
  });

  it("storage budgets are isolated per owner address", async () => {
    const repo = new MemoryApiRepository();
    // Exhaust A's 100-byte test budget, then verify B is unaffected
    await recordStorageBytes(repo, STELLAR_ADDR_A, 100);
    const resultB = await checkStorageByteBudget(repo, STELLAR_ADDR_B, 1, "storage_stage", 100);
    expect(resultB.allowed).toBe(true);
  });

  it("fails closed on counter failure for storage_stage (fail_closed policy)", async () => {
    const repo = new FailingRepository("getCounter");
    const result = await checkStorageByteBudget(repo, STELLAR_ADDR_A, 1024, "storage_stage");
    expect(result).toMatchObject({
      allowed: false,
      outage: { check: "storage_bytes", policy: "fail_closed", route: "storage_stage" },
    });
  });
});

// ─── Chain-write budget ───────────────────────────────────────────────────────

describe("checkChainWriteLimit", () => {
  it("allows under the chain-write budget", async () => {
    const repo = new MemoryApiRepository();
    const result = await checkChainWriteLimit(repo, STELLAR_ADDR_A);
    expect(result).toMatchObject({ allowed: true });
  });

  it("blocks after chain-write budget exhausted", async () => {
    const repo = new MemoryApiRepository();
    for (let i = 0; i < CHAIN_WRITE_BUDGET.max; i++) {
      await repo.incrementCounter(
        `abuse:chain_write:${STELLAR_ADDR_A}`,
        CHAIN_WRITE_BUDGET.windowSeconds,
      );
    }
    const result = await checkChainWriteLimit(repo, STELLAR_ADDR_A);
    expect(result).toMatchObject({ allowed: false });
    expect(result.retryAfterSeconds).toBe(CHAIN_WRITE_BUDGET.windowSeconds);
  });

  it("chain-write budgets are isolated per account", async () => {
    const repo = new MemoryApiRepository();
    for (let i = 0; i < CHAIN_WRITE_BUDGET.max; i++) {
      await repo.incrementCounter(
        `abuse:chain_write:${STELLAR_ADDR_A}`,
        CHAIN_WRITE_BUDGET.windowSeconds,
      );
    }
    const resultB = await checkChainWriteLimit(repo, STELLAR_ADDR_B);
    expect(resultB.allowed).toBe(true);
  });

  it("fails closed on counter failure (chain_write check is fail_closed)", async () => {
    const repo = new FailingRepository("incrementCounter");
    const result = await checkChainWriteLimit(repo, STELLAR_ADDR_A);
    expect(result).toMatchObject({
      allowed: false,
      outage: { check: "chain_write", policy: "fail_closed", route: "chain_write" },
    });
  });
});

// ─── Operator override ────────────────────────────────────────────────────────

describe("hasOperatorOverride", () => {
  it("returns false when STEALTH_ABUSE_BYPASS_TOKEN is not set", () => {
    const original = process.env.STEALTH_ABUSE_BYPASS_TOKEN;
    delete process.env.STEALTH_ABUSE_BYPASS_TOKEN;
    try {
      expect(hasOperatorOverride(makeRequest())).toBe(false);
    } finally {
      if (original !== undefined) process.env.STEALTH_ABUSE_BYPASS_TOKEN = original;
    }
  });

  it("returns false when header is missing", () => {
    process.env.STEALTH_ABUSE_BYPASS_TOKEN = "secret";
    try {
      expect(hasOperatorOverride(makeRequest())).toBe(false);
    } finally {
      delete process.env.STEALTH_ABUSE_BYPASS_TOKEN;
    }
  });

  it("returns false when header does not match token", () => {
    process.env.STEALTH_ABUSE_BYPASS_TOKEN = "secret";
    try {
      expect(
        hasOperatorOverride(makeRequest({ headers: { "x-stealth-operator-token": "wrong" } })),
      ).toBe(false);
    } finally {
      delete process.env.STEALTH_ABUSE_BYPASS_TOKEN;
    }
  });

  it("returns true when header matches token exactly", () => {
    process.env.STEALTH_ABUSE_BYPASS_TOKEN = "mysecrettoken";
    try {
      expect(
        hasOperatorOverride(
          makeRequest({ headers: { "x-stealth-operator-token": "mysecrettoken" } }),
        ),
      ).toBe(true);
    } finally {
      delete process.env.STEALTH_ABUSE_BYPASS_TOKEN;
    }
  });
});

// ─── Central wrapper: enforceAuthLoginLimits ──────────────────────────────────

describe("enforceAuthLoginLimits", () => {
  it("resolves without error for a legitimate request", async () => {
    const repo = new MemoryApiRepository();
    await expect(enforceAuthLoginLimits(repo, TEST_IP)).resolves.toBeUndefined();
  });

  it("throws 429 when IP login budget exhausted", async () => {
    const repo = new MemoryApiRepository();
    for (let i = 0; i < AUTH_IP_BUDGET.login.max; i++) {
      await repo.incrementCounter(
        `abuse:auth_login:ip:${TEST_IP}`,
        AUTH_IP_BUDGET.login.windowSeconds,
      );
    }
    await expect(enforceAuthLoginLimits(repo, TEST_IP)).rejects.toMatchObject({
      status: 429,
      code: "too_many_requests",
    });
  });

  it("includes Retry-After in the rejection details", async () => {
    const repo = new MemoryApiRepository();
    for (let i = 0; i < AUTH_IP_BUDGET.login.max; i++) {
      await repo.incrementCounter(
        `abuse:auth_login:ip:${TEST_IP}`,
        AUTH_IP_BUDGET.login.windowSeconds,
      );
    }
    let thrown: any;
    try {
      await enforceAuthLoginLimits(repo, TEST_IP);
    } catch (e) {
      thrown = e;
    }
    expect(thrown.details).toMatchObject({ retryAfterSeconds: AUTH_IP_BUDGET.login.windowSeconds });
  });

  it("operator override bypasses auth login limits", async () => {
    const repo = new MemoryApiRepository();
    for (let i = 0; i < AUTH_IP_BUDGET.login.max; i++) {
      await repo.incrementCounter(
        `abuse:auth_login:ip:${TEST_IP}`,
        AUTH_IP_BUDGET.login.windowSeconds,
      );
    }
    process.env.STEALTH_ABUSE_BYPASS_TOKEN = "admintoken";
    const req = makeRequest({ headers: { "x-stealth-operator-token": "admintoken" } });
    try {
      await expect(enforceAuthLoginLimits(repo, TEST_IP, req)).resolves.toBeUndefined();
    } finally {
      delete process.env.STEALTH_ABUSE_BYPASS_TOKEN;
    }
  });
});

// ─── Central wrapper: enforceAuthRegisterLimits ───────────────────────────────

describe("enforceAuthRegisterLimits", () => {
  it("resolves without error under the limit", async () => {
    const repo = new MemoryApiRepository();
    await expect(enforceAuthRegisterLimits(repo, TEST_IP)).resolves.toBeUndefined();
  });

  it("throws 429 when IP register budget exhausted", async () => {
    const repo = new MemoryApiRepository();
    for (let i = 0; i < AUTH_IP_BUDGET.register.max; i++) {
      await repo.incrementCounter(
        `abuse:auth_register:ip:${TEST_IP}`,
        AUTH_IP_BUDGET.register.windowSeconds,
      );
    }
    await expect(enforceAuthRegisterLimits(repo, TEST_IP)).rejects.toMatchObject({
      status: 429,
      code: "too_many_requests",
    });
  });

  it("throws 503 on outage with fail_closed policy", async () => {
    const repo = new FailingRepository("incrementCounter");
    await expect(enforceAuthRegisterLimits(repo, TEST_IP)).rejects.toMatchObject({
      status: 503,
      code: "dependency_unavailable",
    });
  });
});

// ─── Central wrapper: enforceRelaySubmitLimits ────────────────────────────────

describe("enforceRelaySubmitLimits", () => {
  it("resolves without error for legitimate relay submit", async () => {
    const repo = new MemoryApiRepository();
    await expect(
      enforceRelaySubmitLimits(repo, TEST_IP, TEST_SESSION, TEST_RELAY_ID),
    ).resolves.toBeUndefined();
  });

  it("throws 429 when session relay quota is exhausted", async () => {
    const repo = new MemoryApiRepository();
    for (let i = 0; i < RELAY_SESSION_BUDGET.max; i++) {
      await repo.incrementCounter(
        `abuse:relay:session:${TEST_SESSION}`,
        RELAY_SESSION_BUDGET.windowSeconds,
      );
    }
    await expect(
      enforceRelaySubmitLimits(repo, TEST_IP, TEST_SESSION, TEST_RELAY_ID),
    ).rejects.toMatchObject({ status: 429 });
  });

  it("operator override bypasses relay limits", async () => {
    const repo = new MemoryApiRepository();
    for (let i = 0; i < RELAY_SESSION_BUDGET.max; i++) {
      await repo.incrementCounter(
        `abuse:relay:session:${TEST_SESSION}`,
        RELAY_SESSION_BUDGET.windowSeconds,
      );
    }
    process.env.STEALTH_ABUSE_BYPASS_TOKEN = "optoken";
    const req = makeRequest({ headers: { "x-stealth-operator-token": "optoken" } });
    try {
      await expect(
        enforceRelaySubmitLimits(repo, TEST_IP, TEST_SESSION, TEST_RELAY_ID, req),
      ).resolves.toBeUndefined();
    } finally {
      delete process.env.STEALTH_ABUSE_BYPASS_TOKEN;
    }
  });
});

// ─── Central wrapper: enforceStorageStageLimits ───────────────────────────────

describe("enforceStorageStageLimits", () => {
  it("resolves without error under budget", async () => {
    const repo = new MemoryApiRepository();
    await expect(enforceStorageStageLimits(repo, STELLAR_ADDR_A, 1024)).resolves.toBeUndefined();
  });

  it("throws 429 when storage byte budget exceeded", async () => {
    const repo = new MemoryApiRepository();
    // Use small representative values to avoid creating millions of array entries
    await recordStorageBytes(repo, STELLAR_ADDR_A, 100);
    await expect(
      enforceStorageStageLimits(repo, STELLAR_ADDR_A, 1, undefined, 100),
    ).rejects.toMatchObject({ status: 429, code: "too_many_requests" });
  });

  it("throws 503 on outage with fail_closed policy for storage_stage", async () => {
    const repo = new FailingRepository("getCounter");
    await expect(enforceStorageStageLimits(repo, STELLAR_ADDR_A, 1024)).rejects.toMatchObject({
      status: 503,
      code: "dependency_unavailable",
    });
  });
});

// ─── Central wrapper: enforceStorageFinalizeLimits ────────────────────────────

describe("enforceStorageFinalizeLimits", () => {
  it("resolves without error under budget", async () => {
    const repo = new MemoryApiRepository();
    await expect(enforceStorageFinalizeLimits(repo, STELLAR_ADDR_A, 1)).resolves.toBeUndefined();
  });

  it("throws 429 when storage byte budget exceeded on finalize", async () => {
    const repo = new MemoryApiRepository();
    // Exhaust a 100-byte test budget
    await recordStorageBytes(repo, STELLAR_ADDR_A, 100);
    await expect(
      enforceStorageFinalizeLimits(repo, STELLAR_ADDR_A, 1, undefined, 100),
    ).rejects.toMatchObject({ status: 429 });
  });
});

// ─── Central wrapper: enforceChainWriteLimits ─────────────────────────────────

describe("enforceChainWriteLimits", () => {
  it("resolves without error under budget", async () => {
    const repo = new MemoryApiRepository();
    await expect(enforceChainWriteLimits(repo, STELLAR_ADDR_A)).resolves.toBeUndefined();
  });

  it("throws 429 when chain-write budget exhausted", async () => {
    const repo = new MemoryApiRepository();
    for (let i = 0; i < CHAIN_WRITE_BUDGET.max; i++) {
      await repo.incrementCounter(
        `abuse:chain_write:${STELLAR_ADDR_A}`,
        CHAIN_WRITE_BUDGET.windowSeconds,
      );
    }
    await expect(enforceChainWriteLimits(repo, STELLAR_ADDR_A)).rejects.toMatchObject({
      status: 429,
      code: "too_many_requests",
    });
  });

  it("throws 503 on outage (fail_closed policy)", async () => {
    const repo = new FailingRepository("incrementCounter");
    await expect(enforceChainWriteLimits(repo, STELLAR_ADDR_A)).rejects.toMatchObject({
      status: 503,
      code: "dependency_unavailable",
    });
  });

  it("includes Retry-After in the rejection details", async () => {
    const repo = new MemoryApiRepository();
    for (let i = 0; i < CHAIN_WRITE_BUDGET.max; i++) {
      await repo.incrementCounter(
        `abuse:chain_write:${STELLAR_ADDR_A}`,
        CHAIN_WRITE_BUDGET.windowSeconds,
      );
    }
    let thrown: any;
    try {
      await enforceChainWriteLimits(repo, STELLAR_ADDR_A);
    } catch (e) {
      thrown = e;
    }
    expect(thrown.details).toMatchObject({
      retryAfterSeconds: CHAIN_WRITE_BUDGET.windowSeconds,
    });
  });

  it("operator override bypasses chain write limits", async () => {
    const repo = new MemoryApiRepository();
    for (let i = 0; i < CHAIN_WRITE_BUDGET.max; i++) {
      await repo.incrementCounter(
        `abuse:chain_write:${STELLAR_ADDR_A}`,
        CHAIN_WRITE_BUDGET.windowSeconds,
      );
    }
    process.env.STEALTH_ABUSE_BYPASS_TOKEN = "chaintoken";
    const req = makeRequest({ headers: { "x-stealth-operator-token": "chaintoken" } });
    try {
      await expect(enforceChainWriteLimits(repo, STELLAR_ADDR_A, req)).resolves.toBeUndefined();
    } finally {
      delete process.env.STEALTH_ABUSE_BYPASS_TOKEN;
    }
  });
});

// ─── Device limit wrapper ─────────────────────────────────────────────────────

describe("enforceDeviceLimit", () => {
  it("resolves without error under the device limit", async () => {
    const repo = new MemoryApiRepository();
    await expect(enforceDeviceLimit(repo, "fp-abc123")).resolves.toBeUndefined();
  });

  it("throws 429 once device limit is exceeded", async () => {
    const repo = new MemoryApiRepository();
    const fp = "fp-overflow";
    // max default is 30
    for (let i = 0; i < 30; i++) {
      await repo.incrementCounter(`device:${fp}`, 60);
    }
    await expect(enforceDeviceLimit(repo, fp)).rejects.toMatchObject({ status: 429 });
  });
});

// ─── Metrics emission ─────────────────────────────────────────────────────────

describe("metrics emission on rejection", () => {
  it("emits auth_limit_rejected counter on login throttle", async () => {
    const repo = new MemoryApiRepository();
    for (let i = 0; i < AUTH_IP_BUDGET.login.max; i++) {
      await repo.incrementCounter(
        `abuse:auth_login:ip:${TEST_IP}`,
        AUTH_IP_BUDGET.login.windowSeconds,
      );
    }
    const spy = vi.spyOn(metrics, "incrementCounter");
    try {
      await enforceAuthLoginLimits(repo, TEST_IP).catch(() => {});
      expect(spy).toHaveBeenCalledWith(
        "auth_limit_rejected",
        expect.objectContaining({ limit: "ip", route: "auth_login" }),
      );
    } finally {
      spy.mockRestore();
    }
  });

  it("emits chain_write_limit_rejected counter on chain throttle", async () => {
    const repo = new MemoryApiRepository();
    for (let i = 0; i < CHAIN_WRITE_BUDGET.max; i++) {
      await repo.incrementCounter(
        `abuse:chain_write:${STELLAR_ADDR_A}`,
        CHAIN_WRITE_BUDGET.windowSeconds,
      );
    }
    const spy = vi.spyOn(metrics, "incrementCounter");
    try {
      await enforceChainWriteLimits(repo, STELLAR_ADDR_A).catch(() => {});
      expect(spy).toHaveBeenCalledWith(
        "chain_write_limit_rejected",
        expect.objectContaining({ limit: "chain_write", accountAddress: STELLAR_ADDR_A }),
      );
    } finally {
      spy.mockRestore();
    }
  });
});

// ─── False-positive safety: legitimate actors ─────────────────────────────────

describe("false-positive safety: legitimate actors are never prematurely blocked", () => {
  it("allows exactly (max - 1) login attempts without blocking", async () => {
    // Seed max-1 counter entries directly, then verify the next check still allows.
    // We do NOT call checkAuthIpLoginLimit in the loop so the counter matches exactly.
    const repo = new MemoryApiRepository();
    for (let i = 0; i < AUTH_IP_BUDGET.login.max - 1; i++) {
      await repo.incrementCounter(
        `abuse:auth_login:ip:${TEST_IP}`,
        AUTH_IP_BUDGET.login.windowSeconds,
      );
    }
    await expect(checkAuthIpLoginLimit(repo, TEST_IP)).resolves.toMatchObject({ allowed: true });
  });

  it("allows exactly (max - 1) relay session submits without blocking", async () => {
    const repo = new MemoryApiRepository();
    for (let i = 0; i < RELAY_SESSION_BUDGET.max - 1; i++) {
      await repo.incrementCounter(
        `abuse:relay:session:${TEST_SESSION}`,
        RELAY_SESSION_BUDGET.windowSeconds,
      );
    }
    await expect(checkRelaySessionLimit(repo, TEST_SESSION)).resolves.toMatchObject({
      allowed: true,
    });
  });

  it("allows exactly (max - 1) chain writes without blocking", async () => {
    const repo = new MemoryApiRepository();
    for (let i = 0; i < CHAIN_WRITE_BUDGET.max - 1; i++) {
      await repo.incrementCounter(
        `abuse:chain_write:${STELLAR_ADDR_A}`,
        CHAIN_WRITE_BUDGET.windowSeconds,
      );
    }
    await expect(checkChainWriteLimit(repo, STELLAR_ADDR_A)).resolves.toMatchObject({
      allowed: true,
    });
  });
});
