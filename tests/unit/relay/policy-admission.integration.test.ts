import { describe, expect, it } from "vitest";
import { ApiError } from "../../../src/server/api/errors";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import { setMailboxPolicy, setSenderRule } from "../../../src/server/api/policy-service";
import { FakeR2Bucket } from "../../../src/services/storage/r2-fake";
import { createRelayObjectStore } from "../../../src/services/relay/object-store";
import { MemoryRelayPersistence } from "../../../src/services/relay/memory-persistence";
import { InProcessRelayWorker } from "../../../src/services/relay/in-process-worker";
import { RelayService, type RelayServiceConfig } from "../../../src/services/relay/relay-service";
import {
  createRelayAdmissionEvaluator,
  type PolicyChainClient,
} from "../../../src/services/relay/policy-admission";
import { handleRelaySubmit } from "../../../src/services/relay/transport";

const sender = `G${"A".repeat(55)}`;
const recipient = `G${"B".repeat(55)}`;

function messageIdFor(label: string): string {
  const hex = Buffer.from(label.padEnd(32, "0")).toString("hex").slice(0, 64);
  return hex;
}

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

function submitRequest(body: Record<string, unknown>, actor = sender) {
  return new Request("https://stealth.test/api/v1/relay/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-stealth-address": actor,
    },
    body: JSON.stringify(body),
  });
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    messageId: "d".repeat(64),
    sender,
    recipient,
    recipientDomain: "example.com",
    payload: "aGVsbG8=",
    postage: "0",
    verified: false,
    ...overrides,
  };
}

describe("relay policy admission integration (BETA-036)", () => {
  it("admits a trusted sender and persists policy version evidence with the message", async () => {
    const repository = new MemoryApiRepository();
    await setSenderRule(repository, recipient, sender, "allow");
    const persistence = new MemoryRelayPersistence();
    const service = new RelayService(
      persistence,
      new InProcessRelayWorker(persistence),
      makeConfig(),
      { evaluator: createRelayAdmissionEvaluator({ repository }), mailbox: repository },
    );

    const result = await service.submit(validBody());
    expect(result.accepted).toBe(true);
    expect(result.admission.kind).toBe("trusted");
    expect(result.admission.policyVersion).toBe(0);

    const stored = persistence.getMessage(result.messageId);
    expect(stored?.admission.reason).toBe("sender_allowed");
    expect(stored?.admission.policyVersion).toBe(result.admission.policyVersion);

    const envelope = await repository.getEnvelope(result.messageId);
    expect(envelope?.metadata).toMatchObject({
      admission: { kind: "trusted", reason: "sender_allowed" },
    });
  });

  it("never stores a blocked payload in the object store or the mailbox", async () => {
    const repository = new MemoryApiRepository();
    await setSenderRule(repository, recipient, sender, "block");
    const bucket = new FakeR2Bucket();
    const objectStore = createRelayObjectStore(bucket as unknown as R2Bucket);
    const persistence = new MemoryRelayPersistence();
    const service = new RelayService(
      persistence,
      new InProcessRelayWorker(persistence),
      makeConfig(),
      {
        evaluator: createRelayAdmissionEvaluator({ repository }),
        objectStore,
        mailbox: repository,
      },
    );

    await expect(service.submit(validBody())).rejects.toMatchObject({
      status: 403,
      code: "forbidden",
      details: { kind: "blocked", reason: "sender_blocked" },
    });

    expect(persistence.getMessage("d".repeat(64))).toBeUndefined();
    expect(await repository.getEnvelope("d".repeat(64))).toBeNull();
    expect(bucket.size).toBe(0);
  });

  it("stores an admitted payload in the object store after evaluation", async () => {
    const repository = new MemoryApiRepository();
    await setMailboxPolicy(repository, recipient, {
      allowUnknown: true,
      requireVerified: false,
      minimumPostage: "0",
    });
    const bucket = new FakeR2Bucket();
    const objectStore = createRelayObjectStore(bucket as unknown as R2Bucket);
    const persistence = new MemoryRelayPersistence();
    const service = new RelayService(
      persistence,
      new InProcessRelayWorker(persistence),
      makeConfig(),
      {
        evaluator: createRelayAdmissionEvaluator({ repository }),
        objectStore,
      },
    );

    const result = await service.submit(validBody({ verified: true }));
    expect(result.admission.kind).toBe("request");
    expect(persistence.getMessage(result.messageId)?.payloadStorageKey).toMatch(/^envelopes\//);
    expect(bucket.size).toBeGreaterThan(0);
  });

  it("does not let a later policy change rewrite a recorded admission", async () => {
    const repository = new MemoryApiRepository();
    await setSenderRule(repository, recipient, sender, "allow");
    const persistence = new MemoryRelayPersistence();
    const service = new RelayService(
      persistence,
      new InProcessRelayWorker(persistence),
      makeConfig(),
      { evaluator: createRelayAdmissionEvaluator({ repository }) },
    );

    const first = await service.submit(validBody());
    expect(first.admission.kind).toBe("trusted");

    await setSenderRule(repository, recipient, sender, "block");
    const replay = await service.submit(validBody());

    expect(replay.replayed).toBe(true);
    expect(replay.admission.kind).toBe("trusted");
    expect(replay.admission.reason).toBe("sender_allowed");
    expect(persistence.getMessage(first.messageId)?.admission.kind).toBe("trusted");
  });

  it("is idempotent: a duplicate messageId does not double-enqueue", async () => {
    const repository = new MemoryApiRepository();
    await setSenderRule(repository, recipient, sender, "allow");
    const persistence = new MemoryRelayPersistence();
    const service = new RelayService(
      persistence,
      new InProcessRelayWorker(persistence),
      makeConfig(),
      { evaluator: createRelayAdmissionEvaluator({ repository }) },
    );

    await service.submit(validBody());
    const replay = await service.submit(validBody());
    expect(replay.replayed).toBe(true);
    expect(replay.queueDepth).toBe(1);
  });

  it("returns 422 priced with requiredPostage when postage is short", async () => {
    const repository = new MemoryApiRepository();
    await setMailboxPolicy(repository, recipient, {
      allowUnknown: true,
      requireVerified: false,
      minimumPostage: "500",
    });
    const persistence = new MemoryRelayPersistence();
    const service = new RelayService(
      persistence,
      new InProcessRelayWorker(persistence),
      makeConfig(),
      { evaluator: createRelayAdmissionEvaluator({ repository }) },
    );

    try {
      await service.submit(validBody({ postage: "100", verified: true }));
      throw new Error("expected priced denial");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      const apiError = error as ApiError;
      expect(apiError.status).toBe(422);
      expect(apiError.code).toBe("insufficient_postage");
      expect(apiError.details).toMatchObject({
        kind: "priced",
        reason: "insufficient_postage",
        requiredPostage: "500",
      });
    }
    expect(persistence.getMessage("d".repeat(64))).toBeUndefined();
  });

  it("returns 403 verified when the recipient requires identity verification", async () => {
    const repository = new MemoryApiRepository();
    await setMailboxPolicy(repository, recipient, {
      allowUnknown: true,
      requireVerified: true,
      minimumPostage: "0",
    });
    const persistence = new MemoryRelayPersistence();
    const service = new RelayService(
      persistence,
      new InProcessRelayWorker(persistence),
      makeConfig(),
      { evaluator: createRelayAdmissionEvaluator({ repository }) },
    );

    const response = await handleRelaySubmit(
      submitRequest(validBody({ verified: false })),
      service,
    );
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe("forbidden");
    expect(body.error.details.kind).toBe("verified");
    expect(JSON.stringify(body)).not.toContain("aGVsbG8=");
  });

  it("falls back to off-chain evaluation when the live chain is stale and still admits", async () => {
    const repository = new MemoryApiRepository();
    await setMailboxPolicy(repository, recipient, {
      allowUnknown: true,
      requireVerified: false,
      minimumPostage: "0",
    });
    const { confirmPolicyWrite } = await import("../../../src/server/api/policy-service");
    await confirmPolicyWrite(repository, recipient, "tx-redacted");

    const chain: PolicyChainClient = {
      evaluate: async () => ({
        allowed: false,
        reason: "unknown_senders_disabled",
        requiredPostage: "0",
        rule: "default",
        version: 0,
      }),
    };
    const persistence = new MemoryRelayPersistence();
    const service = new RelayService(
      persistence,
      new InProcessRelayWorker(persistence),
      makeConfig(),
      { evaluator: createRelayAdmissionEvaluator({ repository, chain }) },
    );

    const result = await service.submit(validBody({ verified: true }));
    expect(result.admission.kind).toBe("request");
    expect(persistence.getMessage(result.messageId)?.admission.source).toBe("offchain_fallback");
  });

  it("covers transport 403 for blocked without leaking mailbox metadata", async () => {
    const repository = new MemoryApiRepository();
    await setSenderRule(repository, recipient, sender, "block");
    const persistence = new MemoryRelayPersistence();
    const service = new RelayService(
      persistence,
      new InProcessRelayWorker(persistence),
      makeConfig(),
      { evaluator: createRelayAdmissionEvaluator({ repository }) },
    );

    const response = await handleRelaySubmit(submitRequest(validBody()), service);
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe("forbidden");
    expect(JSON.stringify(body)).not.toContain("allowUnknown");
    expect(JSON.stringify(body)).not.toContain("minimumPostage");
    expect(JSON.stringify(body)).not.toContain("aGVsbG8=");
  });

  it("admits distinct messages independently after a policy change", async () => {
    const repository = new MemoryApiRepository();
    await setSenderRule(repository, recipient, sender, "allow");
    const persistence = new MemoryRelayPersistence();
    const service = new RelayService(
      persistence,
      new InProcessRelayWorker(persistence),
      makeConfig(),
      { evaluator: createRelayAdmissionEvaluator({ repository }) },
    );

    const firstId = messageIdFor("first-message-id-bytes!!");
    const secondId = messageIdFor("second-message-id-bytes!");
    await service.submit(validBody({ messageId: firstId }));
    await setSenderRule(repository, recipient, sender, "block");

    await expect(service.submit(validBody({ messageId: secondId }))).rejects.toMatchObject({
      code: "forbidden",
      details: { kind: "blocked" },
    });
    expect(persistence.getMessage(firstId)?.admission.kind).toBe("trusted");
    expect(persistence.getMessage(secondId)).toBeUndefined();
  });
});
