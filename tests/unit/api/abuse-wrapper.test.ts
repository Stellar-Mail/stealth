import { describe, expect, it, vi } from "vitest";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import { ApiError } from "../../../src/server/api/errors";
import { withAbuseProtection } from "../../../src/server/api/with-abuse-protection";

const sender = `G${"B".repeat(55)}`;
const recipient = `G${"A".repeat(55)}`;

describe("Centralized Abuse Wrapper Protection Integration", () => {
  it("Scenario 1 (Allowed): processes the request seamlessly when thresholds are under limits", async () => {
    const repository = new MemoryApiRepository();
    const mockHandler = vi.fn().mockResolvedValue({ success: true });

    const policy = { checkAccount: true, checkIp: true };
    const context = { sender, ip: "1.2.3.4" };

    const result = await withAbuseProtection(repository, policy, context, mockHandler);

    expect(result).toEqual({ success: true });
    expect(mockHandler).toHaveBeenCalledTimes(1);
  });

  it("Scenario 2 (Denied): instantly breaks flow, masking internals with stable 429 exceptions", async () => {
    const repository = new MemoryApiRepository();
    const mockHandler = vi.fn().mockResolvedValue({ success: true });

    for (let i = 0; i < 60; i++) {
      await repository.incrementCounter(`abuse:account:${sender}`, 3600);
    }

    const policy = { checkAccount: true };
    const context = { sender };

    await expect(withAbuseProtection(repository, policy, context, mockHandler)).rejects.toThrow(
      ApiError,
    );

    try {
      await withAbuseProtection(repository, policy, context, mockHandler);
    } catch (err: any) {
      expect(err.status).toBe(429);
      expect(err.code).toBe("too_many_requests");
      expect(err.message).toBe("Rate limit exceeded");
      expect(err.details).toHaveProperty("retryAfterSeconds");
    }

    expect(mockHandler).not.toHaveBeenCalled();
  });

  it("Scenario 3 (Service Unavailable): logs warning metrics and fails open if storage repository goes offline", async () => {
    const brokenRepository = {
      incrementCounter: vi.fn().mockRejectedValue(new Error("Redis connection dropped")),
      getCounter: vi.fn().mockRejectedValue(new Error("Redis connection dropped")),
    } as any;

    const mockHandler = vi.fn().mockResolvedValue({ data: "fallback-success" });
    const policy = { checkAccount: true, checkIp: true };
    const context = { sender, ip: "1.2.3.4" };

    const result = await withAbuseProtection(brokenRepository, policy, context, mockHandler);

    expect(result).toEqual({ data: "fallback-success" });
    expect(mockHandler).toHaveBeenCalledTimes(1);
  });
});
