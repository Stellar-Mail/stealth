import { describe, expect, it } from "vitest";

import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import { consumeRouteQuota, RATE_LIMIT_OPERATION_COSTS } from "../../../src/server/api/rate-limit";

describe("weighted route rate limits", () => {
  it("atomically consumes the configured weight", async () => {
    const repository = new MemoryApiRepository();

    await consumeRouteQuota(repository, "account", "actor", "signatureVerification");

    await expect(repository.getCounter("abuse:account:actor")).resolves.toBe(
      RATE_LIMIT_OPERATION_COSTS.signatureVerification,
    );
  });

  it("rejects an expensive operation once its weighted quota is exhausted", async () => {
    const repository = new MemoryApiRepository();

    for (let requestNumber = 0; requestNumber < 5; requestNumber += 1) {
      await expect(
        consumeRouteQuota(repository, "account", "actor", "paymentTransition"),
      ).resolves.toEqual({ allowed: true });
    }

    await expect(
      consumeRouteQuota(repository, "account", "actor", "paymentTransition"),
    ).resolves.toEqual({ allowed: false, retryAfterSeconds: 3600 });
  });

  it("keeps operation costs in immutable server configuration", () => {
    expect(Object.isFrozen(RATE_LIMIT_OPERATION_COSTS)).toBe(true);
    expect(Object.values(RATE_LIMIT_OPERATION_COSTS)).toEqual([1, 3, 5, 10]);
  });
});
