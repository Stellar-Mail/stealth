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
});
