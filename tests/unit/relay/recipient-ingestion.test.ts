import { describe, expect, it, beforeEach } from "vitest";

import { MemoryApiRepository } from "@/server/api/memory-repository";
import { MemoryRelayPersistence } from "@/services/relay/memory-persistence";
import {
  RecipientIngestionService,
  type IngestionResult,
} from "@/services/relay/recipient-ingestion";
import type { RelayEnvelope } from "@/services/relay/persistence";
import type { KeyProvider } from "@/services/crypto/open-envelope";

const ALICE = `G${"A".repeat(55)}`;
const BOB = `G${"B".repeat(55)}`;
const MSG1 = "1".repeat(64);
const MSG2 = "2".repeat(64);
const MSG3 = "3".repeat(64);

function makeRelayEnvelope(overrides: Partial<RelayEnvelope>): RelayEnvelope {
  return {
    messageId: MSG1,
    sender: BOB,
    recipient: ALICE,
    recipientDomain: "stealth.test",
    payload: JSON.stringify({
      version: "v1",
      sender: BOB,
      recipient: ALICE,
      timestamp: "2026-08-20T10:00:00Z",
      encryption_metadata: {
        algorithm: "AES-256-GCM",
        nonce: "dGVzdC1ub25jZQ==",
        mac: "dGVzdC1tYWM=",
        ephemeral_public_key: "dGVzdC1lcGhlbWVyYWw=",
        recipient_key_id: "key-1",
      },
      content_commitment: "a".repeat(64),
      attachments: [],
    }),
    ttlMs: 3600_000,
    receivedAt: "2026-08-20T10:00:00Z",
    admission: {
      policyVersion: 1,
      allowed: true,
      kind: "request",
      reason: "policy_satisfied",
      rule: "default",
      requiredPostage: "0",
      source: "offchain_fallback",
      evaluatedAt: "2026-08-20T10:00:00Z",
    },
    ...overrides,
  };
}

describe("Recipient Queue Ingestion Service (BETA-034)", () => {
  let persistence: MemoryRelayPersistence;
  let repository: MemoryApiRepository;

  beforeEach(() => {
    persistence = new MemoryRelayPersistence();
    repository = new MemoryApiRepository();
  });

  it("ingests queued envelopes and appends to recipient mailbox", async () => {
    const service = new RecipientIngestionService({
      persistence,
      repository,
    });

    const envelope = makeRelayEnvelope({ messageId: MSG1 });
    await persistence.enqueue(envelope);

    const results = await service.ingestRecipientQueue(ALICE);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("delivered");
    expect(results[0].messageId).toBe(MSG1);

    const stored = await repository.getEnvelope(MSG1);
    expect(stored).not.toBeNull();
    expect(stored?.recipientId).toBe(ALICE);
    expect(stored?.senderId).toBe(BOB);
    expect(stored?.status).toBe("pending");
  });

  it("quarantines corrupted or invalid envelopes without leaking secrets", async () => {
    const mockKeys: KeyProvider = {
      async resolveKey() {
        throw new Error("decryption failed: invalid key");
      },
    };

    const service = new RecipientIngestionService({
      persistence,
      repository,
      keys: mockKeys,
    });

    const malformedEnvelope = makeRelayEnvelope({
      messageId: MSG2,
      payload: "corrupted-unparseable-bytes",
    });
    await persistence.enqueue(malformedEnvelope);

    const results = await service.ingestRecipientQueue(ALICE);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("quarantined");
    expect(results[0].diagnosticId).toBeDefined();

    const stored = await repository.getEnvelope(MSG2);
    expect(stored).not.toBeNull();
    expect(stored?.status).toBe("quarantined");
    expect(stored?.ciphertext).toBe(""); // Plaintext/ciphertext never exposed
    expect(stored?.metadata?.quarantined).toBe(true);
  });

  it("enforces exactly-once delivery and deduplicates repeat ingest attempts", async () => {
    const service = new RecipientIngestionService({
      persistence,
      repository,
    });

    const envelope = makeRelayEnvelope({ messageId: MSG1 });
    const firstResult = await service.ingestEnvelope(envelope);
    expect(firstResult.status).toBe("delivered");

    // Second ingestion attempt for the same envelope
    const secondResult = await service.ingestEnvelope(envelope);
    expect(secondResult.status).toBe("duplicate");

    // Mailbox repository contains only 1 entry
    const list = await repository.listRecipientEnvelopes(ALICE, { status: "all" });
    expect(list.items).toHaveLength(1);
  });

  it("safely handles concurrent workers without duplicate insertions", async () => {
    const service1 = new RecipientIngestionService({ persistence, repository });
    const service2 = new RecipientIngestionService({ persistence, repository });

    const envelope = makeRelayEnvelope({ messageId: MSG3 });

    // Both workers attempt to ingest the envelope concurrently
    const [res1, res2] = await Promise.all([
      service1.ingestEnvelope(envelope),
      service2.ingestEnvelope(envelope),
    ]);

    const deliveredCount = [res1, res2].filter((r) => r.status === "delivered").length;
    const skippedOrDuplicate = [res1, res2].filter(
      (r) => r.status === "skipped" || r.status === "duplicate",
    ).length;

    expect(deliveredCount).toBe(1);
    expect(skippedOrDuplicate).toBe(1);

    const stored = await repository.listRecipientEnvelopes(ALICE, { status: "all" });
    expect(stored.items).toHaveLength(1);
  });
});
