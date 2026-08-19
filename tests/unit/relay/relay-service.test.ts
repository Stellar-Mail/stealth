import { describe, expect, it } from "vitest";

import { MemoryRelayPersistence } from "../../../src/services/relay/memory-persistence";
import { RelayService, type RelayServiceConfig } from "../../../src/services/relay/relay-service";
import type { RelayEnvelope, RelayPersistence } from "../../../src/services/relay/persistence";
import { InProcessRelayWorker } from "../../../src/services/relay/in-process-worker";
import { z } from "zod";

import type { RelaySubmissionInput } from "../../../src/services/relay/relay-service";

const sender = `G${"A".repeat(55)}`;
const recipient = `G${"B".repeat(55)}`;
const messageId = "d".repeat(64);

function makeConfig(overrides: Partial<RelayServiceConfig> = {}): RelayServiceConfig {
  return {
    serviceName: "stealth-relay",
    version: "test-build",
    apiVersion: "v1",
    protocolVersion: "v1",
    timeoutMs: 1_000,
    network: {
      horizonUrl: "https://horizon-testnet.stellar.org",
      sorobanRpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015",
    },
    ...overrides,
  };
}

function makeService(config: RelayServiceConfig = makeConfig()) {
  const persistence = new MemoryRelayPersistence();
  const worker = new InProcessRelayWorker(persistence);
  return {
    persistence,
    worker,
    service: new RelayService(persistence, worker, config),
  };
}

function validInput() {
  return {
    messageId,
    sender,
    recipient,
    recipientDomain: "example.com",
    payload: "aGVsbG8=",
    ttlMs: 60_000,
  };
}

class FailingPersistence implements RelayPersistence {
  async ping(): Promise<void> {}
  async getQueueDepth(): Promise<number> {
    throw new Error("queue unavailable");
  }
  async getRetryCount(): Promise<number> {
    return 0;
  }
  async getDeadLetterCount(): Promise<number> {
    return 0;
  }
  async enqueue(_envelope: RelayEnvelope): Promise<{ messageId: string }> {
    return { messageId };
  }
  async dequeue(): Promise<RelayEnvelope | null> {
    return null;
  }
  async recordRetry(): Promise<void> {}
  async recordDeadLetter(): Promise<void> {}
  async listRecipientQueue(_recipient: string): Promise<RelayEnvelope[]> {
    return [];
  }
}

describe("RelayService health", () => {
  it("reports ok liveness with pinned fields and no secrets", async () => {
    const { service } = makeService();
    const health = await service.checkHealth();

    expect(health).toEqual({
      status: "ok",
      service: "stealth-relay",
      version: "test-build",
      time: expect.any(String),
    });
    const serialized = JSON.stringify(health);
    expect(serialized).not.toContain("Test SDF Network ; September 2015");
    expect(serialized).not.toContain("horizon");
    expect(serialized).not.toContain("secret");
  });
});

describe("RelayService readiness", () => {
  it("is ready when storage, queue, and network are healthy", async () => {
    const { service } = makeService();
    const readiness = await service.checkReadiness();

    expect(readiness.ready).toBe(true);
    expect(readiness.dependencies).toEqual({
      storage: "ok",
      queue: "ok",
      network: "ok",
    });
  });

  it("is not ready when storage is unavailable", async () => {
    const { persistence, service } = makeService();
    persistence.setAvailable(false);

    const readiness = await service.checkReadiness();
    expect(readiness.ready).toBe(false);
    expect(readiness.dependencies.storage).toBe("unavailable");
  });

  it("is not ready when the queue is unavailable", async () => {
    const worker = new InProcessRelayWorker(new FailingPersistence());
    const service = new RelayService(new FailingPersistence(), worker, makeConfig());

    const readiness = await service.checkReadiness();
    expect(readiness.ready).toBe(false);
    expect(readiness.dependencies.queue).toBe("unavailable");
  });

  it("is not ready when required network configuration is invalid", async () => {
    const { service } = makeService(
      makeConfig({
        network: {
          horizonUrl: "not-a-url",
          sorobanRpcUrl: "",
          networkPassphrase: "",
        },
      }),
    );

    const readiness = await service.checkReadiness();
    expect(readiness.ready).toBe(false);
    expect(readiness.dependencies.network).toBe("unavailable");
  });

  it("honors an injected network check", async () => {
    const { service } = makeService();
    const readiness = await service.checkReadiness({
      checkNetwork: () => false,
    });
    expect(readiness.ready).toBe(false);
    expect(readiness.dependencies.network).toBe("unavailable");
  });

  it("marks a slow dependency as timed out", async () => {
    const { service } = makeService();
    const readiness = await service.checkReadiness({
      timeoutMs: 1,
      checkNetwork: () => new Promise((resolve) => setTimeout(() => resolve(true), 50)),
    });
    expect(readiness.ready).toBe(false);
    expect(readiness.dependencies.network).toBe("timeout");
  });

  it("exposes no URLs, secrets, or user data in readiness output", async () => {
    const { service } = makeService();
    const readiness = await service.checkReadiness();

    const serialized = JSON.stringify(readiness);
    expect(serialized).not.toContain("https://");
    expect(serialized).not.toContain("Test SDF Network ; September 2015");
    for (const status of Object.values(readiness.dependencies)) {
      expect(["ok", "unavailable", "timeout"]).toContain(status);
    }
  });
});

describe("RelayService version", () => {
  it("pins the version contract fields", () => {
    const { service } = makeService();
    expect(service.getVersion()).toEqual({
      app: "stealth-relay",
      apiVersion: "v1",
      protocolVersion: "v1",
      build: "test-build",
    });
  });
});

describe("RelayService submit", () => {
  it("enqueues a valid message and reports acceptance", async () => {
    const { persistence, service } = makeService();
    const result = await service.submit(validInput());

    expect(result.accepted).toBe(true);
    expect(result.messageId).toBe(messageId);
    expect(result.queueDepth).toBe(1);
    expect(persistence.getMessage(messageId)).toMatchObject({
      sender,
      recipient,
      recipientDomain: "example.com",
      ttlMs: 60_000,
      receivedAt: expect.any(String),
    });
  });

  it("applies the default TTL when none is supplied", async () => {
    const { persistence, service } = makeService();
    const input: RelaySubmissionInput = {
      messageId,
      sender,
      recipient,
      recipientDomain: "example.com",
      payload: "aGVsbG8=",
    };

    await service.submit(input);
    expect(persistence.getMessage(messageId)?.ttlMs).toBe(60 * 60 * 1000);
  });

  it("rejects a message whose sender is not a Stellar address", async () => {
    const { service } = makeService();
    const input = validInput();
    input.sender = "INVALID";

    await expect(service.submit(input)).rejects.toBeInstanceOf(z.ZodError);
  });

  it("rejects a message with an oversized payload", async () => {
    const { service } = makeService();
    const input = validInput();
    input.payload = "x".repeat(2 * 1024 * 1024 + 1);

    await expect(service.submit(input)).rejects.toBeInstanceOf(z.ZodError);
  });
});
