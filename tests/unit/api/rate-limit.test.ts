import { describe, expect, it } from "vitest";

import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import {
  consumeRouteQuota,
  RATE_LIMIT_OPERATION_COSTS,
  checkAuthFailureThrottle,
  recordAuthFailure,
  AUTH_FAILURE_LIMITS,
} from "../../../src/server/api/rate-limit";

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

  describe("authentication failure throttling", () => {
    it("allows authentication initially", async () => {
      const repository = new MemoryApiRepository();
      const result = await checkAuthFailureThrottle(repository, "192.0.2.1", "G_ALICE");
      expect(result).toEqual({ allowed: true });
    });

    it("throttles after repeated failures on IP+Account", async () => {
      const repository = new MemoryApiRepository();

      for (let i = 0; i < 4; i++) {
        const check = await checkAuthFailureThrottle(repository, "192.0.2.1", "G_ALICE");
        expect(check).toEqual({ allowed: true });
        await recordAuthFailure(repository, "192.0.2.1", "G_ALICE");
      }

      const check5 = await checkAuthFailureThrottle(repository, "192.0.2.1", "G_ALICE");
      expect(check5).toEqual({ allowed: true });
      await recordAuthFailure(repository, "192.0.2.1", "G_ALICE");

      const check6 = await checkAuthFailureThrottle(repository, "192.0.2.1", "G_ALICE");
      expect(check6).toEqual({ allowed: false, retryAfterSeconds: 900 });
    });

    it("does not block successful authentication from another IP (isolation)", async () => {
      const repository = new MemoryApiRepository();

      for (let i = 0; i < 5; i++) {
        await recordAuthFailure(repository, "192.0.2.1", "G_ALICE");
      }

      expect(await checkAuthFailureThrottle(repository, "192.0.2.1", "G_ALICE")).toEqual({
        allowed: false,
        retryAfterSeconds: 900,
      });

      expect(await checkAuthFailureThrottle(repository, "192.0.2.2", "G_ALICE")).toEqual({
        allowed: true,
      });

      expect(await checkAuthFailureThrottle(repository, "192.0.2.1", "G_BOB")).toEqual({
        allowed: true,
      });
    });

    it("escalates delays correctly", async () => {
      const repository = new MemoryApiRepository();

      const res1 = await recordAuthFailure(repository, "192.0.2.1", "G_ALICE");
      expect(res1.delaySeconds).toBe(1);

      const res2 = await recordAuthFailure(repository, "192.0.2.1", "G_ALICE");
      expect(res2.delaySeconds).toBe(2);

      const res3 = await recordAuthFailure(repository, "192.0.2.1", "G_ALICE");
      expect(res3.delaySeconds).toBe(4);

      for (let i = 0; i < 3; i++) {
        await recordAuthFailure(repository, "192.0.2.1", "G_ALICE");
      }
      const res7 = await recordAuthFailure(repository, "192.0.2.1", "G_ALICE");
      expect(res7.delaySeconds).toBe(60);
    });

    it("throttles IP wide after repeated failures across different accounts", async () => {
      const repository = new MemoryApiRepository();

      for (let i = 0; i < 20; i++) {
        const acct = `G_ACTOR_${i}`;
        expect(await checkAuthFailureThrottle(repository, "192.0.2.1", acct)).toEqual({
          allowed: true,
        });
        await recordAuthFailure(repository, "192.0.2.1", acct);
      }

      expect(await checkAuthFailureThrottle(repository, "192.0.2.1", "G_NEW_ACTOR")).toEqual({
        allowed: false,
        retryAfterSeconds: 900,
      });

      expect(await checkAuthFailureThrottle(repository, "192.0.2.2", "G_NEW_ACTOR")).toEqual({
        allowed: true,
      });
    });

    it("does not leak account existence (uniform behavior)", async () => {
      const repository = new MemoryApiRepository();

      const nonExistentAcct = "G_NON_EXISTENT";
      const existingAcct = "G_EXISTING";

      for (let i = 0; i < 5; i++) {
        await recordAuthFailure(repository, "192.0.2.1", nonExistentAcct);
        await recordAuthFailure(repository, "192.0.2.2", existingAcct);
      }

      const resNonExistent = await checkAuthFailureThrottle(
        repository,
        "192.0.2.1",
        nonExistentAcct,
      );
      const resExisting = await checkAuthFailureThrottle(repository, "192.0.2.2", existingAcct);

      expect(resNonExistent).toEqual(resExisting);
      expect(resNonExistent.allowed).toBe(false);
    });
  });
});
