import { describe, expect, it, vi } from "vitest";

import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import * as metrics from "../../../src/server/api/metrics";
import {
  ABUSE_OUTAGE_POLICIES,
  buildDeviceFingerprint,
  checkAccountLimit,
  checkDeviceLimit,
  checkIpLimit,
  checkProofFailureLimit,
  checkRelayLimit,
  checkSenderRecipientLimit,
  recordProofFailure,
  checkStorageByteBudget,
  checkChainWriteBudget,
  checkSessionLimit,
  checkRecipientLimit,
  isOperatorOverride,
  enforceCentralAbuse,
  STORAGE_BYTE_BUDGETS,
  CHAIN_WRITE_BUDGETS,
  canonicalizeSubjectAddress,
} from "../../../src/server/api/abuse-service";

const sender = `G${"B".repeat(55)}`;
const recipient = `G${"A".repeat(55)}`;
const relayId = "relay-001";

class FailingAbuseRepository extends MemoryApiRepository {
  constructor(private readonly failingOperation: "getCounter" | "incrementCounter") {
    super();
  }

  override async getCounter(key: string) {
    if (this.failingOperation === "getCounter") {
      throw new Error(`counter read unavailable: ${key}`);
    }
    return super.getCounter(key);
  }

  override async incrementCounter(key: string, windowSeconds: number) {
    if (this.failingOperation === "incrementCounter") {
      throw new Error(`counter write unavailable: ${key}`);
    }
    return super.incrementCounter(key, windowSeconds);
  }
}

describe("abuse service", () => {
  it("defines an outage policy for every postage submit abuse check", () => {
    expect(ABUSE_OUTAGE_POLICIES.postage_submit).toEqual({
      account: "fail_closed",
      device: "fail_open",
      ip: "fail_open",
      proof_failure: "fail_closed",
      relay: "fail_open",
      sender_recipient: "fail_closed",
      chain_write: "fail_closed",
      recipient: "fail_closed",
    });
  });

  it("allows sender under account limit", async () => {
    const repository = new MemoryApiRepository();
    const result = await checkAccountLimit(repository, sender);
    expect(result).toMatchObject({ allowed: true });
  });

  it("blocks sender over account limit", async () => {
    const repository = new MemoryApiRepository();
    for (let i = 0; i < 50; i++) {
      await repository.incrementCounter(`abuse:account:${sender}`, 3600);
    }
    const result = await checkAccountLimit(repository, sender);
    expect(result).toMatchObject({ allowed: false });
    expect(result.retryAfterSeconds).toBeTypeOf("number");
  });

  it("flags unknown ip but allows through", async () => {
    const repository = new MemoryApiRepository();
    const result = await checkIpLimit(repository, "unknown");
    expect(result).toMatchObject({ allowed: true, flagged: true });
  });

  it("blocks ip over limit", async () => {
    const repository = new MemoryApiRepository();
    for (let i = 0; i < 100; i++) {
      await repository.incrementCounter(`abuse:ip:1.2.3.4`, 3600);
    }
    const result = await checkIpLimit(repository, "1.2.3.4");
    expect(result).toMatchObject({ allowed: false });
    expect(result.retryAfterSeconds).toBeTypeOf("number");
  });

  it("blocks targeted harassment over sender-recipient limit", async () => {
    const repository = new MemoryApiRepository();
    for (let i = 0; i < 10; i++) {
      await repository.incrementCounter(`abuse:pair:${sender}:${recipient}`, 3600);
    }
    const result = await checkSenderRecipientLimit(repository, sender, recipient);
    expect(result).toMatchObject({ allowed: false });
    expect(result.retryAfterSeconds).toBeTypeOf("number");
  });

  it("blocks sender after proof failures", async () => {
    const repository = new MemoryApiRepository();
    for (let i = 0; i < 5; i++) {
      await recordProofFailure(repository, sender);
    }
    const result = await checkProofFailureLimit(repository, sender);
    expect(result).toMatchObject({ allowed: false });
    expect(result.retryAfterSeconds).toBeTypeOf("number");
  });

  it("allows sender under proof failure limit", async () => {
    const repository = new MemoryApiRepository();
    await recordProofFailure(repository, sender);
    const result = await checkProofFailureLimit(repository, sender);
    expect(result).toMatchObject({ allowed: true });
  });

  it("blocks relay over limit", async () => {
    const repository = new MemoryApiRepository();
    for (let i = 0; i < 500; i++) {
      await repository.incrementCounter(`abuse:relay:${relayId}`, 3600);
    }
    const result = await checkRelayLimit(repository, relayId);
    expect(result).toMatchObject({ allowed: false });
    expect(result.retryAfterSeconds).toBeTypeOf("number");
  });

  it("builds deterministic device fingerprints", () => {
    const headers = {
      userAgent: "  Mozilla/5.0  ",
      acceptLanguage: "en-US,en;q=0.9",
      acceptEncoding: "gzip, br",
      ipPrefix: "203.0.113",
    };
    expect(buildDeviceFingerprint(headers)).toBe(buildDeviceFingerprint(headers));
  });

  it("changes fingerprint when the user agent changes", () => {
    const base = {
      acceptLanguage: "en-US,en;q=0.9",
      acceptEncoding: "gzip, br",
      ipPrefix: "203.0.113",
    };
    expect(
      buildDeviceFingerprint({
        ...base,
        userAgent: "Mozilla/5.0",
      }),
    ).not.toBe(
      buildDeviceFingerprint({
        ...base,
        userAgent: "curl/8.0.1",
      }),
    );
  });

  it("returns a valid fingerprint when all fields are missing", () => {
    const fingerprint = buildDeviceFingerprint({});
    expect(fingerprint).toMatch(/^[a-f0-9]{16}$/);
  });

  it("blocks a fingerprint after exceeding the device window max", async () => {
    const repository = new MemoryApiRepository();
    const fingerprint = buildDeviceFingerprint({
      userAgent: "Mozilla/5.0",
      acceptLanguage: "en-US",
      acceptEncoding: "gzip",
      ipPrefix: "203.0.113",
    });

    for (let i = 0; i < 30; i++) {
      const result = await checkDeviceLimit(repository, fingerprint);
      expect(result).toMatchObject({ allowed: true });
    }

    const blocked = await checkDeviceLimit(repository, fingerprint);
    expect(blocked).toMatchObject({ allowed: false });
    expect(blocked.retryAfterSeconds).toBe(60);
  });

  it("allows a fingerprint again after the device window resets", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-16T00:00:00.000Z"));

    try {
      const repository = new MemoryApiRepository();
      const fingerprint = buildDeviceFingerprint({
        userAgent: "Mozilla/5.0",
        acceptLanguage: "en-US",
        acceptEncoding: "gzip",
        ipPrefix: "203.0.113",
      });

      for (let i = 0; i < 30; i++) {
        const result = await checkDeviceLimit(repository, fingerprint);
        expect(result).toMatchObject({ allowed: true });
      }

      vi.setSystemTime(new Date("2026-06-16T00:01:01.000Z"));

      await expect(checkDeviceLimit(repository, fingerprint)).resolves.toMatchObject({
        allowed: true,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("fails closed and emits observability when account checks are unavailable", async () => {
    const repository = new FailingAbuseRepository("incrementCounter");
    const metricSpy = vi.spyOn(metrics, "incrementCounter");
    const auditSpy = vi.spyOn(metrics, "recordAuditEvent");

    try {
      const result = await checkAccountLimit(repository, sender);

      expect(result).toMatchObject({
        allowed: false,
        outage: {
          check: "account",
          policy: "fail_closed",
          route: "postage_submit",
        },
        retryAfterSeconds: 60,
      });
      expect(metricSpy).toHaveBeenCalledWith(
        "abuse_dependency_fallback",
        expect.objectContaining({
          check: "account",
          decision: "deny",
          policy: "fail_closed",
          route: "postage_submit",
        }),
      );
      expect(auditSpy).toHaveBeenCalledWith(
        "abuse.dependency_fallback",
        expect.objectContaining({
          check: "account",
          decision: "deny",
          policy: "fail_closed",
        }),
      );
    } finally {
      metricSpy.mockRestore();
      auditSpy.mockRestore();
    }
  });

  it("fails open and emits observability when ip checks are unavailable", async () => {
    const repository = new FailingAbuseRepository("incrementCounter");
    const metricSpy = vi.spyOn(metrics, "incrementCounter");
    const auditSpy = vi.spyOn(metrics, "recordAuditEvent");

    try {
      const result = await checkIpLimit(repository, "203.0.113.42");

      expect(result).toMatchObject({
        allowed: true,
        flagged: true,
        outage: {
          check: "ip",
          policy: "fail_open",
          route: "postage_submit",
        },
      });
      expect(metricSpy).toHaveBeenCalledWith(
        "abuse_dependency_fallback",
        expect.objectContaining({
          check: "ip",
          decision: "allow",
          policy: "fail_open",
        }),
      );
      expect(auditSpy).toHaveBeenCalledWith(
        "abuse.dependency_fallback",
        expect.objectContaining({
          check: "ip",
          decision: "allow",
          policy: "fail_open",
        }),
      );
    } finally {
      metricSpy.mockRestore();
      auditSpy.mockRestore();
    }
  });

  it("treats proof-failure counter read timeouts as fail closed", async () => {
    class TimeoutRepository extends FailingAbuseRepository {
      override async getCounter(key: string): Promise<number> {
        const error = new Error(`counter timeout: ${key}`);
        error.name = "TimeoutError";
        throw error;
      }
    }

    await expect(
      checkProofFailureLimit(new TimeoutRepository("getCounter"), sender),
    ).resolves.toMatchObject({
      allowed: false,
      outage: {
        check: "proof_failure",
        policy: "fail_closed",
      },
    });
  });

  describe("BETA-049: address canonicalization (anti-evasion)", () => {
    it("canonicalizes lowercase and padded addresses so limits cannot be evaded", async () => {
      const repository = new MemoryApiRepository();
      const lowerSender = sender.toLowerCase();
      const paddedSender = `   ${sender}   `;

      // Fill account limit using the canonical address
      for (let i = 0; i < 50; i++) {
        await checkAccountLimit(repository, sender);
      }

      // Attacker attempts to evade using lowercase or whitespace padding
      const lowerResult = await checkAccountLimit(repository, lowerSender);
      expect(lowerResult.allowed).toBe(false);

      const paddedResult = await checkAccountLimit(repository, paddedSender);
      expect(paddedResult.allowed).toBe(false);
    });

    it("canonicalizes sender-recipient pair addresses", async () => {
      const repository = new MemoryApiRepository();
      const lowerSender = sender.toLowerCase();
      const paddedRecipient = `  ${recipient}  `;

      for (let i = 0; i < 10; i++) {
        await checkSenderRecipientLimit(repository, sender, recipient);
      }

      const evasionResult = await checkSenderRecipientLimit(
        repository,
        lowerSender,
        paddedRecipient,
      );
      expect(evasionResult.allowed).toBe(false);
    });
  });

  describe("BETA-049: storage byte budgets", () => {
    it("allows attachment bytes under account and IP budgets", async () => {
      const repository = new MemoryApiRepository();
      const result = await checkStorageByteBudget(
        repository,
        { ip: "192.0.2.1", account: sender, session: "sess_123" },
        1024 * 1024, // 1MB
      );
      expect(result).toMatchObject({ allowed: true });
    });

    it("blocks when storage byte budget is exceeded per account", async () => {
      const repository = new MemoryApiRepository();
      const limit = STORAGE_BYTE_BUDGETS.account.maxBytes;

      // Consume up to limit
      const first = await checkStorageByteBudget(repository, { account: sender }, limit);
      expect(first.allowed).toBe(true);

      // Exceed limit
      const second = await checkStorageByteBudget(repository, { account: sender }, 1);
      expect(second.allowed).toBe(false);
      expect(second.reason).toBe("storage_byte_budget_exceeded");
      expect(second.retryAfterSeconds).toBe(STORAGE_BYTE_BUDGETS.account.windowSeconds);
    });

    it("blocks when storage byte budget is exceeded per IP", async () => {
      const repository = new MemoryApiRepository();
      const limit = STORAGE_BYTE_BUDGETS.ip.maxBytes;

      const first = await checkStorageByteBudget(repository, { ip: "198.51.100.2" }, limit);
      expect(first.allowed).toBe(true);

      const second = await checkStorageByteBudget(repository, { ip: "198.51.100.2" }, 1);
      expect(second.allowed).toBe(false);
      expect(second.reason).toBe("storage_byte_budget_exceeded");
    });
  });

  describe("BETA-049: chain-write budgets", () => {
    it("allows chain writes within account budget and blocks when exceeded", async () => {
      const repository = new MemoryApiRepository();
      const max = CHAIN_WRITE_BUDGETS.account.max;

      for (let i = 0; i < max; i++) {
        const check = await checkChainWriteBudget(repository, { account: sender });
        expect(check.allowed).toBe(true);
      }

      const blocked = await checkChainWriteBudget(repository, { account: sender });
      expect(blocked.allowed).toBe(false);
      expect(blocked.reason).toBe("chain_write_budget_exceeded");
      expect(blocked.retryAfterSeconds).toBe(CHAIN_WRITE_BUDGETS.account.windowSeconds);
    });
  });

  describe("BETA-049: session & recipient rate limits", () => {
    it("throttles excessive requests per session", async () => {
      const repository = new MemoryApiRepository();
      const sessionId = "sess_test_abc123";

      for (let i = 0; i < 100; i++) {
        const check = await checkSessionLimit(repository, sessionId);
        expect(check.allowed).toBe(true);
      }

      const blocked = await checkSessionLimit(repository, sessionId);
      expect(blocked.allowed).toBe(false);
      expect(blocked.retryAfterSeconds).toBe(3600);
    });

    it("throttles excessive traffic targeting a single recipient", async () => {
      const repository = new MemoryApiRepository();

      for (let i = 0; i < 50; i++) {
        const check = await checkRecipientLimit(repository, recipient);
        expect(check.allowed).toBe(true);
      }

      const blocked = await checkRecipientLimit(repository, recipient);
      expect(blocked.allowed).toBe(false);
      expect(blocked.retryAfterSeconds).toBe(3600);
    });
  });

  describe("BETA-049: operator overrides", () => {
    it("requires configured secret and rejects public literals", () => {
      const originalEnv = process.env.STEALTH_OPERATOR_OVERRIDE_TOKEN;
      try {
        delete process.env.STEALTH_OPERATOR_OVERRIDE_TOKEN;

        // When unconfigured, no override is permitted
        expect(
          isOperatorOverride(new Headers({ "x-stealth-operator-override": "stealth-token" })),
        ).toBe(false);
        expect(isOperatorOverride({ "x-stealth-operator-override": "true" })).toBe(false);
        expect(isOperatorOverride({ "x-stealth-operator-override": "operator-bypass" })).toBe(
          false,
        );

        // Configure secret
        process.env.STEALTH_OPERATOR_OVERRIDE_TOKEN = "super-secret-token-1234";

        const validHeaders = new Headers({
          "x-stealth-operator-override": "super-secret-token-1234",
        });
        expect(isOperatorOverride(validHeaders)).toBe(true);

        const plainHeaders = { "x-stealth-operator-override": "super-secret-token-1234" };
        expect(isOperatorOverride(plainHeaders)).toBe(true);

        // Public literals and incorrect tokens are rejected
        expect(isOperatorOverride({ "x-stealth-operator-override": "true" })).toBe(false);
        expect(isOperatorOverride({ "x-stealth-operator-override": "operator-bypass" })).toBe(
          false,
        );
        expect(
          isOperatorOverride(new Headers({ "x-stealth-operator-override": "wrong-token" })),
        ).toBe(false);
        expect(isOperatorOverride(null)).toBe(false);
      } finally {
        if (originalEnv !== undefined) {
          process.env.STEALTH_OPERATOR_OVERRIDE_TOKEN = originalEnv;
        } else {
          delete process.env.STEALTH_OPERATOR_OVERRIDE_TOKEN;
        }
      }
    });

    it("bypasses all abuse checks when operator override is active with valid configured secret", async () => {
      const originalEnv = process.env.STEALTH_OPERATOR_OVERRIDE_TOKEN;
      process.env.STEALTH_OPERATOR_OVERRIDE_TOKEN = "test-override-secret";
      try {
        const repository = new MemoryApiRepository();
        // Exhaust account limit
        for (let i = 0; i < 50; i++) {
          await checkAccountLimit(repository, sender);
        }

        const overrideHeaders = new Headers({
          "x-stealth-operator-override": "test-override-secret",
        });

        const decision = await enforceCentralAbuse(repository, {
          route: "relay_submit",
          ip: "203.0.113.1",
          account: sender,
          recipient,
          storageBytes: 1000,
          headers: overrideHeaders,
        });

        expect(decision.allowed).toBe(true);
      } finally {
        if (originalEnv !== undefined) {
          process.env.STEALTH_OPERATOR_OVERRIDE_TOKEN = originalEnv;
        } else {
          delete process.env.STEALTH_OPERATOR_OVERRIDE_TOKEN;
        }
      }
    });
  });

  describe("BETA-049: central abuse policy enforcer & false-positive resistance", () => {
    it("allows legitimate requests with all parameters within limits", async () => {
      const repository = new MemoryApiRepository();
      const decision = await enforceCentralAbuse(repository, {
        route: "postage_submit",
        ip: "192.0.2.55",
        account: sender,
        recipient,
        storageBytes: 1024,
        isChainWrite: true,
      });

      expect(decision.allowed).toBe(true);
    });

    it("enforces storage byte limit centrally before expensive operations", async () => {
      const repository = new MemoryApiRepository();
      const decision = await enforceCentralAbuse(repository, {
        route: "attachment_upload",
        ip: "192.0.2.55",
        account: sender,
        storageBytes: 60 * 1024 * 1024, // 60MB exceeds 50MB limit
      });

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe("storage_byte_budget_exceeded");
    });
  });
});
