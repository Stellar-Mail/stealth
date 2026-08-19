import { describe, expect, it } from "vitest";

import { KvRelayPersistence } from "../../../src/services/relay/kv-persistence";
import type { RelayAdmissionRecord } from "../../../src/services/relay/persistence";

class MockKVNamespace {
  public store = new Map<string, string>();

  async get(key: string, type: "text" | "json") {
    const val = this.store.get(key);
    if (val === undefined) return null;
    if (type === "json") return JSON.parse(val);
    return val;
  }

  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }
}

const messageId = "a".repeat(64);
const sender = `G${"B".repeat(55)}`;
const recipient = `G${"A".repeat(55)}`;

function blockedRecord(): RelayAdmissionRecord {
  return {
    messageId,
    sender,
    recipient,
    payloadStored: false,
    recordedAt: "2026-08-19T21:00:00.000Z",
    admission: {
      allowed: false,
      disposition: "blocked",
      reason: "sender_blocked",
      rule: "block",
      policyVersion: 1,
      requiredPostage: "0",
      source: "offchain",
      evaluatedAt: "2026-08-19T21:00:00.000Z",
    },
  };
}

describe("KvRelayPersistence admission", () => {
  it("recordAdmission is first-write-wins and does not store a payload key on deny", async () => {
    const persistence = new KvRelayPersistence(new MockKVNamespace() as unknown as KVNamespace);
    const first = blockedRecord();
    const claimed = await persistence.recordAdmission(first);
    expect(claimed.duplicate).toBe(false);

    const retry = await persistence.recordAdmission({
      ...first,
      payloadStored: true,
      payloadKey: "must-not-win",
      admission: { ...first.admission, allowed: true, disposition: "trusted", reason: "sender_allowed" },
    });
    expect(retry.duplicate).toBe(true);
    expect(retry.record).toEqual(first);
    expect(retry.record.payloadStored).toBe(false);
    expect(retry.record.payloadKey).toBeUndefined();

    await expect(persistence.getAdmission(messageId)).resolves.toEqual(first);
  });

  it("enqueue is idempotent on messageId", async () => {
    const persistence = new KvRelayPersistence(new MockKVNamespace() as unknown as KVNamespace);
    const envelope = {
      messageId,
      sender,
      recipient,
      recipientDomain: "example.com",
      payload: "aGVsbG8=",
      ttlMs: 60_000,
      receivedAt: "2026-08-19T21:00:00.000Z",
    };
    await persistence.enqueue(envelope);
    await persistence.enqueue({ ...envelope, payload: "changed" });
    expect(await persistence.getQueueDepth()).toBe(1);
  });
});
