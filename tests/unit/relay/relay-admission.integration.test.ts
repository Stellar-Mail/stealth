/**
 * Cross-boundary integration for relay policy admission (Issue #1943 BETA-036).
 *
 * Exercises the live relay submit path across repository, chain client,
 * object store, persistence, and HTTP transport. Chain and R2 are isolated
 * test doubles; the evaluator, service, and transport are the production modules.
 */
import { describe, expect, it } from "vitest";

import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import { setMailboxPolicy, setSenderRule } from "../../../src/server/api/policy-service";
import { createRelayAdmissionEvaluator } from "../../../src/services/relay/admission";
import { InProcessRelayWorker } from "../../../src/services/relay/in-process-worker";
import { MemoryRelayPersistence } from "../../../src/services/relay/memory-persistence";
import { createRelayObjectStore } from "../../../src/services/relay/object-store";
import { RelayService, type RelayServiceConfig } from "../../../src/services/relay/relay-service";
import { handleRelaySubmit } from "../../../src/services/relay/transport";
import { InMemoryPolicyChainClient } from "../../../src/services/stellar/policy-chain-client";
import { FakeR2Bucket } from "../../../src/services/storage/r2-fake";

const sender = `G${"B".repeat(55)}`;
const recipient = `G${"A".repeat(55)}`;

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

async function buildStack() {
  const repository = new MemoryApiRepository();
  const chain = new InMemoryPolicyChainClient();
  const bucket = new FakeR2Bucket();
  const objectStore = createRelayObjectStore(bucket as unknown as R2Bucket);
  const persistence = new MemoryRelayPersistence();
  const worker = new InProcessRelayWorker(persistence);
  const service = new RelayService(persistence, worker, makeConfig(), {
    admission: createRelayAdmissionEvaluator({ repository, chainClient: chain }),
    objectStore,
  });
  return { repository, chain, bucket, persistence, service };
}

describe("relay admission integration", () => {
  it("trusted journey: chain-current allow rule admits and stores the payload", async () => {
    const { repository, chain, bucket, persistence, service } = await buildStack();
    await setMailboxPolicy(repository, recipient, {
      allowUnknown: false,
      requireVerified: true,
      minimumPostage: "1000",
    });
    await setSenderRule(repository, recipient, sender, "allow");
    chain.seedMailbox(
      recipient,
      {
        allowUnknown: false,
        requireVerified: true,
        requireReceipt: false,
        minimumPostage: "1000",
      },
      2,
    );
    chain.seedSenderRule(recipient, sender, "allow");

    const messageId = "a".repeat(64);
    const response = await handleRelaySubmit(
      submitRequest({
        messageId,
        sender,
        recipient,
        recipientDomain: "example.com",
        payload: "aGVsbG8=",
        postage: "0",
        verified: false,
      }),
      service,
    );

    expect(response.status).toBe(202);
    const body = await response.json();
    expect(body.data.admission).toMatchObject({
      allowed: true,
      disposition: "trusted",
      reason: "sender_allowed",
      source: "chain",
    });
    expect(persistence.getMessage(messageId)?.payload).toBe("aGVsbG8=");
    expect(bucket.size).toBeGreaterThan(0);
    expect(JSON.stringify(body)).not.toContain("secret");
  });

  it("blocked journey: ciphertext never reaches object storage or the queue", async () => {
    const { repository, chain, bucket, persistence, service } = await buildStack();
    await setMailboxPolicy(repository, recipient, {
      allowUnknown: true,
      requireVerified: false,
      minimumPostage: "0",
    });
    await setSenderRule(repository, recipient, sender, "block");
    chain.seedMailbox(
      recipient,
      {
        allowUnknown: true,
        requireVerified: false,
        requireReceipt: false,
        minimumPostage: "0",
      },
      1,
    );
    chain.seedSenderRule(recipient, sender, "block");

    const messageId = "b".repeat(64);
    const response = await handleRelaySubmit(
      submitRequest({
        messageId,
        sender,
        recipient,
        recipientDomain: "example.com",
        payload: "dG9wLXNlY3JldC1wbGFpbnRleHQ=",
      }),
      service,
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe("forbidden");
    expect(body.error.details.disposition).toBe("blocked");
    expect(JSON.stringify(body)).not.toContain("dG9wLXNlY3JldC1wbGFpbnRleHQ=");
    expect(persistence.getMessage(messageId)).toBeUndefined();
    expect(bucket.size).toBe(0);
  });

  it("idempotent retry returns the original admission after a policy change", async () => {
    const { repository, persistence, service } = await buildStack();
    await setMailboxPolicy(repository, recipient, {
      allowUnknown: true,
      requireVerified: false,
      minimumPostage: "0",
    });

    const messageId = "c".repeat(64);
    const payload = {
      messageId,
      sender,
      recipient,
      recipientDomain: "example.com",
      payload: "aGVsbG8=",
    };
    const first = await handleRelaySubmit(submitRequest(payload), service);
    expect(first.status).toBe(202);
    const firstBody = await first.json();

    await setSenderRule(repository, recipient, sender, "block");
    const second = await handleRelaySubmit(submitRequest(payload), service);
    expect(second.status).toBe(202);
    const secondBody = await second.json();
    expect(secondBody.data.replayed).toBe(true);
    expect(secondBody.data.admission).toEqual(firstBody.data.admission);
    expect(persistence.getMessage(messageId)?.admission.disposition).toBe("request");
  });

  it("verified journey: unverified sender is denied without storing ciphertext", async () => {
    const { repository, chain, bucket, persistence, service } = await buildStack();
    await setMailboxPolicy(repository, recipient, {
      allowUnknown: true,
      requireVerified: true,
      minimumPostage: "0",
    });
    chain.seedMailbox(
      recipient,
      {
        allowUnknown: true,
        requireVerified: true,
        requireReceipt: false,
        minimumPostage: "0",
      },
      1,
    );

    const messageId = "d".repeat(64);
    const response = await handleRelaySubmit(
      submitRequest({
        messageId,
        sender,
        recipient,
        recipientDomain: "example.com",
        payload: "aGVsbG8=",
        verified: false,
      }),
      service,
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.details).toMatchObject({
      disposition: "verified",
      reason: "verification_required",
    });
    expect(JSON.stringify(body)).not.toContain("aGVsbG8=");
    expect(persistence.getMessage(messageId)).toBeUndefined();
    expect(bucket.size).toBe(0);
  });

  it("priced journey: insufficient postage is denied; meeting the floor is admitted", async () => {
    const { repository, chain, bucket, persistence, service } = await buildStack();
    await setMailboxPolicy(repository, recipient, {
      allowUnknown: true,
      requireVerified: false,
      minimumPostage: "500",
    });
    chain.seedMailbox(
      recipient,
      {
        allowUnknown: true,
        requireVerified: false,
        requireReceipt: false,
        minimumPostage: "500",
      },
      1,
    );

    const deniedId = "e".repeat(64);
    const denied = await handleRelaySubmit(
      submitRequest({
        messageId: deniedId,
        sender,
        recipient,
        recipientDomain: "example.com",
        payload: "aGVsbG8=",
        postage: "499",
      }),
      service,
    );
    expect(denied.status).toBe(422);
    const deniedBody = await denied.json();
    expect(deniedBody.error.code).toBe("insufficient_postage");
    expect(deniedBody.error.details.disposition).toBe("priced");
    expect(persistence.getMessage(deniedId)).toBeUndefined();
    expect(bucket.size).toBe(0);

    const admittedId = "f".repeat(64);
    const admitted = await handleRelaySubmit(
      submitRequest({
        messageId: admittedId,
        sender,
        recipient,
        recipientDomain: "example.com",
        payload: "aGVsbG8=",
        postage: "500",
      }),
      service,
    );
    expect(admitted.status).toBe(202);
    const admittedBody = await admitted.json();
    expect(admittedBody.data.admission).toMatchObject({
      allowed: true,
      disposition: "priced",
      reason: "policy_satisfied",
    });
    expect(persistence.getMessage(admittedId)?.payload).toBe("aGVsbG8=");
    expect(bucket.size).toBeGreaterThan(0);
  });

  it("stale-chain fallback evaluates the current off-chain policy, not the stale ledger", async () => {
    const { repository, chain, persistence, service } = await buildStack();
    await setMailboxPolicy(repository, recipient, {
      allowUnknown: true,
      requireVerified: false,
      minimumPostage: "0",
    });
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

    const messageId = "11".repeat(32);
    const response = await handleRelaySubmit(
      submitRequest({
        messageId,
        sender,
        recipient,
        recipientDomain: "example.com",
        payload: "aGVsbG8=",
      }),
      service,
    );

    expect(response.status).toBe(202);
    const body = await response.json();
    expect(body.data.admission).toMatchObject({
      allowed: true,
      disposition: "request",
      source: "stale_chain_fallback",
    });
    expect(persistence.getMessage(messageId)?.payload).toBe("aGVsbG8=");
  });
});
