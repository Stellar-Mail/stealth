import { describe, expect, it } from "vitest";

import { checkApiReadiness } from "../../../src/server/api/health";
import type { ApiRepository } from "../../../src/server/api/repository";

function createRepository(overrides: Partial<ApiRepository> = {}): ApiRepository {
  return {
    getCounter: async () => 0,
    acquireIdempotencyRecord: async () => ({ status: "acquired" }),
    getIdempotencyRecord: async () => null,
    getPolicy: async () => null,
    getPostage: async () => null,
    getReceipt: async () => null,
    createReceiptIfAbsent: async (receipt) => ({ created: true, receipt }),
    markReceiptRead: async () => ({ outcome: "not-found" }),
    getRelayDeadLetterCount: async () => 0,
    getRelayLastFailedDelivery: async () => null,
    getRelayLastSuccessfulDelivery: async () => null,
    getRelayQueueDepth: async () => 0,
    getRelayRetryCount: async () => 0,
    getSenderRule: async () => "default",
    incrementCounter: async () => 1,
    setIdempotencyRecord: async () => undefined,
    setPolicy: async (_owner, policy) => policy,
    setPostage: async (postage) => postage,
    setReceipt: async (receipt) => receipt,
    setSenderRule: async (_owner, _sender, rule) => rule,
    transitionPostage: async () => ({ outcome: "not-found" }),
    ...overrides,
  } as any;
}

function never<T>(): Promise<T> {
  return new Promise(() => undefined);
}

describe("API health readiness", () => {
  it("reports ready when required bindings, storage, and coordinator respond", async () => {
    const result = await checkApiReadiness({
      getContext: async () => ({ repository: createRepository() }) as any,
      timeoutMs: 25,
    });

    expect(result).toEqual({
      dependencies: {
        bindings: "ok",
        coordinator: "ok",
        storage: "ok",
      },
      ready: true,
      timeoutMs: 25,
    });
  });

  it("fails readiness when required bindings cannot be created", async () => {
    const result = await checkApiReadiness({
      getContext: async () => {
        throw new Error("STEALTH_KV=secret-prod-namespace is missing");
      },
      timeoutMs: 25,
    });

    expect(result.ready).toBe(false);
    expect(result.dependencies).toEqual({
      bindings: "unavailable",
      coordinator: "unavailable",
      storage: "unavailable",
    });
    expect(JSON.stringify(result)).not.toContain("secret-prod-namespace");
  });

  it("fails readiness when required storage is unavailable", async () => {
    const result = await checkApiReadiness({
      getContext: async () =>
        ({
          repository: createRepository({
            getPolicy: async () => {
              throw new Error("kv connection details should not leak");
            },
          }),
        }) as any,
      timeoutMs: 25,
    });

    expect(result.ready).toBe(false);
    expect(result.dependencies).toEqual({
      bindings: "ok",
      coordinator: "ok",
      storage: "unavailable",
    });
    expect(JSON.stringify(result)).not.toContain("kv connection details");
  });

  it("bounds slow dependency checks with timeouts", async () => {
    const result = await checkApiReadiness({
      getContext: async () =>
        ({
          repository: createRepository({
            getCounter: () => never<number>(),
          }),
        }) as any,
      timeoutMs: 5,
    });

    expect(result.ready).toBe(false);
    expect(result.dependencies).toEqual({
      bindings: "ok",
      coordinator: "timeout",
      storage: "ok",
    });
  });
});
