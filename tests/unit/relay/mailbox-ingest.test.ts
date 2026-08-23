import { describe, expect, it } from "vitest";

import { FakeR2Bucket } from "../../../src/services/storage/r2-fake";
import { ingestMailboxEnvelope } from "../../../src/services/relay/ingest";
import { MemoryMailboxSyncPersistence } from "../../../src/services/relay/memory-mailbox-sync";
import { MemoryRelayPersistence } from "../../../src/services/relay/memory-persistence";
import { createRelayObjectStore } from "../../../src/services/relay/object-store";
import { InProcessRelayWorker } from "../../../src/services/relay/in-process-worker";
import type { RelayEnvelope } from "../../../src/services/relay/persistence";

const sender = `G${"A".repeat(55)}`;
const recipient = `G${"B".repeat(55)}`;

function messageId(n: number): string {
  return n.toString(16).padStart(64, "0");
}

const ingestNow = () => new Date("2026-08-19T00:00:01.000Z");

function envelope(overrides: Partial<RelayEnvelope> = {}): RelayEnvelope {
  return {
    messageId: messageId(1),
    sender,
    recipient,
    recipientDomain: "example.com",
    payload: "aGVsbG8=",
    ttlMs: 60_000,
    receivedAt: "2026-08-19T00:00:00.000Z",
    admission: {
      policyVersion: 0,
      allowed: true,
      kind: "request",
      reason: "policy_satisfied",
      rule: "default",
      requiredPostage: "0",
      source: "offchain_fallback",
      evaluatedAt: "2026-08-19T00:00:00.000Z",
    },
    ...overrides,
  };
}

describe("mailbox ingestion", () => {
  it("delivers a valid opaque payload and appends a single upsert", async () => {
    const persistence = new MemoryMailboxSyncPersistence();
    const first = await ingestMailboxEnvelope(persistence, envelope(), { now: ingestNow });
    const second = await ingestMailboxEnvelope(persistence, envelope(), { now: ingestNow });
    expect(first).toMatchObject({ status: "delivered", created: true, seq: 1 });
    expect(second).toMatchObject({ status: "delivered", created: false, seq: 1 });
    const page = await persistence.listEvents(recipient, 0, 10);
    expect(page.events).toHaveLength(1);
    expect(page.events[0]?.ciphertext).toBe("aGVsbG8=");
  });

  it("quarantines invalid envelopes without exposing the payload", async () => {
    const persistence = new MemoryMailboxSyncPersistence();
    const bad = envelope({ payload: "!!!not-base64!!!" });
    const result = await ingestMailboxEnvelope(persistence, bad, { now: ingestNow });
    expect(result).toMatchObject({
      status: "quarantined",
      reason: "invalid_payload_encoding",
      created: true,
    });
    const stored = await persistence.getQuarantine(bad.messageId);
    expect(stored).toEqual({
      messageId: bad.messageId,
      recipient,
      reason: "invalid_payload_encoding",
      receivedAt: bad.receivedAt,
    });
    expect(JSON.stringify(stored)).not.toContain("!!!");
    const page = await persistence.listEvents(recipient, 0, 10);
    expect(page.events).toEqual([]);
  });

  it("quarantines inner envelopes whose sender does not match the relay wrapper", async () => {
    const persistence = new MemoryMailboxSyncPersistence();
    const inner = {
      payload: {
        version: "v1",
        sender: `G${"C".repeat(55)}`,
        recipient,
        timestamp: "2026-08-19T00:00:00.000Z",
      },
      ciphertext: "aaaa",
    };
    const payload = Buffer.from(JSON.stringify(inner), "utf8").toString("base64");
    const result = await ingestMailboxEnvelope(persistence, envelope({ payload }), {
      now: ingestNow,
    });
    expect(result).toMatchObject({ status: "quarantined", reason: "sender_mismatch" });
    expect(JSON.stringify(await persistence.listEvents(recipient, 0, 10))).not.toContain("aaaa");
  });

  it("does not duplicate delivery under concurrent workers", async () => {
    const persistence = new MemoryMailboxSyncPersistence();
    const shared = envelope();
    const results = await Promise.all([
      ingestMailboxEnvelope(persistence, shared, { now: ingestNow }),
      ingestMailboxEnvelope(persistence, shared, { now: ingestNow }),
      ingestMailboxEnvelope(persistence, shared, { now: ingestNow }),
    ]);
    const delivered = results.filter((result) => result.status === "delivered");
    expect(delivered.filter((result) => result.created)).toHaveLength(1);
    const page = await persistence.listEvents(recipient, 0, 10);
    expect(page.events).toHaveLength(1);
  });

  it("concurrent workers cannot expose a quarantined payload", async () => {
    const persistence = new MemoryMailboxSyncPersistence();
    const bad = envelope({ payload: "%%%%" });
    const results = await Promise.all([
      ingestMailboxEnvelope(persistence, bad, { now: ingestNow }),
      ingestMailboxEnvelope(persistence, bad, { now: ingestNow }),
    ]);
    expect(
      results.every((result) => result.status === "quarantined" || result.status === "skipped"),
    ).toBe(true);
    const page = await persistence.listEvents(recipient, 0, 10);
    expect(page.events).toEqual([]);
    expect(JSON.stringify(results)).not.toContain("%%%%");
  });

  it("drives recipient ingestion from the relay queue exactly once", async () => {
    const queue = new MemoryRelayPersistence();
    const mailbox = new MemoryMailboxSyncPersistence();
    await queue.enqueue(envelope());
    await queue.enqueue(envelope());
    const worker = new InProcessRelayWorker(queue, {
      pollIntervalMs: 10,
      onMessage: async (item) => {
        await ingestMailboxEnvelope(mailbox, item, { now: ingestNow });
      },
    });
    await worker.start();
    const deadline = Date.now() + 500;
    while (Date.now() < deadline && (await queue.getQueueDepth()) > 0) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    await worker.stop();
    expect(await queue.getQueueDepth()).toBe(0);
    const page = await mailbox.listEvents(recipient, 0, 10);
    expect(page.events).toHaveLength(1);
  });

  it("stores a valid body in object storage and never stores quarantined bytes", async () => {
    const bucket = new FakeR2Bucket();
    const objectStore = createRelayObjectStore(bucket as unknown as R2Bucket, {
      stagedTtlMs: 60_000,
    });
    const persistence = new MemoryMailboxSyncPersistence();
    const delivered = await ingestMailboxEnvelope(persistence, envelope(), {
      now: ingestNow,
      objectStore,
    });
    expect(delivered.status).toBe("delivered");
    if (delivered.status === "delivered") {
      expect(delivered.objectKey).toMatch(/^envelopes\//);
      const stored = await objectStore.getEnvelopeBody(delivered.objectKey!, recipient);
      expect(stored).not.toBeNull();
    }

    const beforeQuarantine = bucket.size;
    const quarantined = await ingestMailboxEnvelope(
      persistence,
      envelope({ messageId: messageId(9), payload: "not*valid" }),
      { now: ingestNow, objectStore },
    );
    expect(quarantined.status).toBe("quarantined");
    expect(bucket.size).toBe(beforeQuarantine);
  });
});
