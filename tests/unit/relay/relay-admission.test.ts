import { describe, expect, it } from "vitest";
import { z } from "zod";

import { ApiError } from "../../../src/server/api/errors";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import { setMailboxPolicy, setSenderRule } from "../../../src/server/api/policy-service";
import { createRelayAdmissionEvaluator } from "../../../src/services/relay/admission";
import { InProcessRelayWorker } from "../../../src/services/relay/in-process-worker";
import { MemoryRelayPersistence } from "../../../src/services/relay/memory-persistence";
import type { RelayEnvelope, RelayPersistence } from "../../../src/services/relay/persistence";
import { RelayService, type RelayServiceConfig } from "../../../src/services/relay/relay-service";
import { InMemoryPolicyChainClient } from "../../../src/services/stellar/policy-chain-client";
import { createRelayObjectStore } from "../../../src/services/relay/object-store";
import { FakeR2Bucket } from "../../../src/services/storage/r2-fake";

const sender = `G${"B".repeat(55)}`;
const recipient = `G${"A".repeat(55)}`;
const messageId = "d".repeat(64);

function makeConfig(): RelayServiceConfig {
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
  };
}

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    messageId,
    sender,
    recipient,
    recipientDomain: "example.com",
    payload: "aGVsbG8=",
    ttlMs: 60_000,
    ...overrides,
  };
}

async function makeAdmittingService(options?: {
  chain?: InMemoryPolicyChainClient;
  objectStore?: ReturnType<typeof createRelayObjectStore>;
}) {
  const repository = new MemoryApiRepository();
  await setMailboxPolicy(repository, recipient, {
    allowUnknown: true,
    requireVerified: false,
    minimumPostage: "0",
  });
  const persistence = new MemoryRelayPersistence();
  const worker = new InProcessRelayWorker(persistence);
  const admission = createRelayAdmissionEvaluator({
    repository,
    chainClient: options?.chain ?? null,
  });
  const service = new RelayService(persistence, worker, makeConfig(), {
    admission,
    objectStore: options?.objectStore,
  });
  return { repository, persistence, service, admission };
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
  async getAdmission() {
    return null;
  }
  async recordAdmission(record: { messageId: string }) {
    return { record: record as never, duplicate: false };
  }
  async enqueue(_envelope: RelayEnvelope): Promise<{ messageId: string }> {
    return { messageId };
  }
  async dequeue(): Promise<RelayEnvelope | null> {
    return null;
  }
  async recordRetry(): Promise<void> {}
  async recordDeadLetter(): Promise<void> {}
  async listRecipientQueue(): Promise<RelayEnvelope[]> {
    return [];
  }
}

describe("RelayService submit policy admission", () => {
  it("admits a request-policy unknown sender and persists evidence", async () => {
    const { persistence, service } = await makeAdmittingService();
    const result = await service.submit(validInput());

    expect(result.accepted).toBe(true);
    expect(result.replayed).toBe(false);
    expect(result.admission).toMatchObject({
      allowed: true,
      disposition: "request",
      reason: "policy_satisfied",
      policyVersion: 1,
      source: "offchain",
    });
    const stored = persistence.getMessage(messageId);
    expect(stored?.payload).toBe("aGVsbG8=");
    expect(stored?.admission?.disposition).toBe("request");
  });

  it("never stores payload for a blocked sender", async () => {
    const { repository, persistence, service } = await makeAdmittingService();
    await setSenderRule(repository, recipient, sender, "block");

    await expect(service.submit(validInput())).rejects.toMatchObject({
      status: 403,
      code: "forbidden",
    });

    expect(persistence.getMessage(messageId)).toBeUndefined();
    expect(persistence.storedPayloadCount()).toBe(0);
    const recorded = await persistence.getAdmission(messageId);
    expect(recorded).toMatchObject({
      payloadStored: false,
      admission: { allowed: false, disposition: "blocked", reason: "sender_blocked" },
    });
  });

  it("does not write blocked payloads to object storage", async () => {
    const bucket = new FakeR2Bucket();
    const objectStore = createRelayObjectStore(bucket as unknown as R2Bucket);
    const { repository, persistence, service } = await makeAdmittingService({ objectStore });
    await setSenderRule(repository, recipient, sender, "block");

    await expect(service.submit(validInput())).rejects.toBeInstanceOf(ApiError);
    expect(persistence.getMessage(messageId)).toBeUndefined();
    expect(bucket.size).toBe(0);
  });

  it("trusted sender is admitted even when unverified with zero postage", async () => {
    const { repository, service } = await makeAdmittingService();
    await setSenderRule(repository, recipient, sender, "allow");
    const result = await service.submit(validInput({ verified: false, postage: "0" }));
    expect(result.admission.disposition).toBe("trusted");
  });

  it("verified policy denies an unverified sender without storing payload", async () => {
    const { repository, persistence, service } = await makeAdmittingService();
    await setMailboxPolicy(repository, recipient, {
      allowUnknown: true,
      requireVerified: true,
      minimumPostage: "0",
    });
    await expect(service.submit(validInput({ verified: false }))).rejects.toMatchObject({
      status: 403,
      code: "forbidden",
    });
    expect(persistence.storedPayloadCount()).toBe(0);
  });

  it("priced policy returns insufficient_postage without storing payload", async () => {
    const { repository, persistence, service } = await makeAdmittingService();
    await setMailboxPolicy(repository, recipient, {
      allowUnknown: true,
      requireVerified: false,
      minimumPostage: "500",
    });
    await expect(service.submit(validInput({ postage: "100" }))).rejects.toMatchObject({
      status: 422,
      code: "insufficient_postage",
    });
    expect(persistence.storedPayloadCount()).toBe(0);
  });

  it("a later policy change cannot rewrite a recorded admission", async () => {
    const { repository, service } = await makeAdmittingService();
    const first = await service.submit(validInput());
    expect(first.admission.disposition).toBe("request");

    await setSenderRule(repository, recipient, sender, "block");
    const replay = await service.submit(validInput());
    expect(replay.replayed).toBe(true);
    expect(replay.admission).toEqual(first.admission);
    expect(replay.admission.disposition).toBe("request");
  });

  it("blocked retries replay the original denial after the sender is later allowed", async () => {
    const { repository, persistence, service } = await makeAdmittingService();
    await setSenderRule(repository, recipient, sender, "block");
    await expect(service.submit(validInput())).rejects.toMatchObject({ code: "forbidden" });

    await setSenderRule(repository, recipient, sender, "allow");
    await expect(service.submit(validInput())).rejects.toMatchObject({
      code: "forbidden",
    });
    expect(persistence.storedPayloadCount()).toBe(0);
  });

  it("applies a current chain sender tier as priced admission", async () => {
    const chain = new InMemoryPolicyChainClient();
    chain.seedMailbox(
      recipient,
      {
        allowUnknown: true,
        requireVerified: false,
        requireReceipt: false,
        minimumPostage: "0",
      },
      2,
    );
    chain.seedSenderTier(recipient, sender, "800");
    const { persistence, service } = await makeAdmittingService({ chain });
    await expect(service.submit(validInput({ postage: "100" }))).rejects.toMatchObject({
      code: "insufficient_postage",
    });
    expect(persistence.storedPayloadCount()).toBe(0);

    const result = await service.submit(validInput({ messageId: "e".repeat(64), postage: "800" }));
    expect(result.admission).toMatchObject({
      allowed: true,
      disposition: "priced",
      reason: "tier_satisfied",
      source: "chain",
    });
  });

  it("rejects submit when policy admission is not configured", async () => {
    const persistence = new MemoryRelayPersistence();
    const worker = new InProcessRelayWorker(persistence);
    const service = new RelayService(persistence, worker, makeConfig());
    await expect(service.submit(validInput())).rejects.toMatchObject({
      status: 503,
      code: "dependency_unavailable",
    });
    expect(persistence.storedPayloadCount()).toBe(0);
  });

  it("falls back to off-chain policy when the chain version is stale", async () => {
    const chain = new InMemoryPolicyChainClient();
    chain.seedMailbox(
      recipient,
      {
        allowUnknown: false,
        requireVerified: true,
        requireReceipt: false,
        minimumPostage: "0",
      },
      1,
    );
    const { service } = await makeAdmittingService({ chain });
    // Off-chain version is 1 after setMailboxPolicy; bump it by writing again.
    // schedulePolicyWrite no-ops on the same policy, so seed chain behind by using version 0.
    chain.seedMailbox(
      recipient,
      {
        allowUnknown: false,
        requireVerified: true,
        requireReceipt: false,
        minimumPostage: "0",
      },
      0,
    );

    const result = await service.submit(validInput());
    expect(result.admission.source).toBe("stale_chain_fallback");
    expect(result.admission.disposition).toBe("request");
  });

  it("uses the live chain snapshot when chain is current", async () => {
    const chain = new InMemoryPolicyChainClient();
    chain.seedMailbox(
      recipient,
      {
        allowUnknown: true,
        requireVerified: false,
        requireReceipt: false,
        minimumPostage: "250",
      },
      2,
    );
    const { repository, service } = await makeAdmittingService({ chain });
    // Off-chain version is 1; chain version 2 is current.
    void repository;
    await expect(service.submit(validInput({ postage: "0" }))).rejects.toMatchObject({
      code: "insufficient_postage",
    });
  });

  it("falls back to off-chain when the chain is unavailable", async () => {
    const chain = new InMemoryPolicyChainClient();
    chain.unavailable = true;
    const { service } = await makeAdmittingService({ chain });
    const result = await service.submit(validInput());
    expect(result.admission.source).toBe("offchain");
    expect(result.accepted).toBe(true);
  });

  it("rejects malformed sender without evaluating policy", async () => {
    const { service } = await makeAdmittingService();
    await expect(service.submit(validInput({ sender: "INVALID" }))).rejects.toBeInstanceOf(
      z.ZodError,
    );
  });

  it("readiness still works when queue persistence fails", async () => {
    const worker = new InProcessRelayWorker(new FailingPersistence());
    const service = new RelayService(new FailingPersistence(), worker, makeConfig());
    const readiness = await service.checkReadiness();
    expect(readiness.ready).toBe(false);
    expect(readiness.dependencies.queue).toBe("unavailable");
  });
});
