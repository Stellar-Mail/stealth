import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ApiError } from "../../../src/server/api/errors";
import { MailboxSyncService } from "../../../src/services/relay/mailbox-sync-service";
import { MemoryMailboxSyncPersistence } from "../../../src/services/relay/memory-mailbox-sync";
import { FULL_RESYNC_EVENT_BOUND } from "../../../src/services/relay/mailbox-sync-types";
import { encodeMailboxCursor } from "../../../src/services/relay/mailbox-cursor";

const SECRET = "test-mailbox-cursor-secret";
const owner = `G${"A".repeat(55)}`;
const sender = `G${"B".repeat(55)}`;
const deviceId = "device-one";

function messageId(n: number): string {
  return n.toString(16).padStart(64, "0");
}

function makeService(nowMs: number) {
  const persistence = new MemoryMailboxSyncPersistence();
  const service = new MailboxSyncService(persistence, { now: () => nowMs });
  return { persistence, service };
}

describe("MailboxSyncService domain", () => {
  beforeEach(() => {
    process.env.STEALTH_CURSOR_SECRET = SECRET;
  });

  afterEach(() => {
    delete process.env.STEALTH_CURSOR_SECRET;
  });

  it("performs an initial sync then a delta without duplicating events", async () => {
    const { persistence, service } = makeService(1_000);
    await persistence.appendEvent({
      type: "upsert",
      messageId: messageId(1),
      recipient: owner,
      sender,
      occurredAt: "2026-08-19T00:00:00.000Z",
      ciphertext: "aGVsbG8=",
    });
    await persistence.appendEvent({
      type: "upsert",
      messageId: messageId(2),
      recipient: owner,
      sender,
      occurredAt: "2026-08-19T00:00:01.000Z",
      ciphertext: "aGVsbG8=",
    });

    const initial = await service.sync(owner, { deviceId });
    expect(initial.mode).toBe("initial");
    expect(initial.events.map((event) => event.seq)).toEqual([1, 2]);
    expect(initial.hasMore).toBe(false);

    const replay = await service.sync(owner, { deviceId, cursor: initial.cursor });
    expect(replay.mode).toBe("delta");
    expect(replay.events).toEqual([]);

    await persistence.appendEvent({
      type: "upsert",
      messageId: messageId(3),
      recipient: owner,
      sender,
      occurredAt: "2026-08-19T00:00:02.000Z",
      ciphertext: "aGVsbG8=",
    });
    const delta = await service.sync(owner, { deviceId, cursor: initial.cursor });
    expect(delta.events.map((event) => event.messageId)).toEqual([messageId(3)]);
    expect(delta.events[0]?.seq).toBe(3);
  });

  it("includes tombstones on delta so deletions are not missed after reconnect", async () => {
    const { persistence, service } = makeService(1_000);
    await persistence.appendEvent({
      type: "upsert",
      messageId: messageId(1),
      recipient: owner,
      sender,
      occurredAt: "2026-08-19T00:00:00.000Z",
      ciphertext: "aGVsbG8=",
    });
    const initial = await service.sync(owner, { deviceId });
    await service.recordTombstone(owner, messageId(1), "deleted");
    const delta = await service.sync(owner, { deviceId, cursor: initial.cursor });
    expect(delta.events).toEqual([
      expect.objectContaining({ type: "tombstone", messageId: messageId(1), seq: 2 }),
    ]);
  });

  it("appends upserts exactly once", async () => {
    const { persistence } = makeService(1_000);
    const input = {
      type: "upsert" as const,
      messageId: messageId(1),
      recipient: owner,
      sender,
      occurredAt: "2026-08-19T00:00:00.000Z",
      ciphertext: "aGVsbG8=",
    };
    const first = await persistence.appendEvent(input);
    const second = await persistence.appendEvent(input);
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.event.seq).toBe(first.event.seq);
    const page = await persistence.listEvents(owner, 0, 10);
    expect(page.events).toHaveLength(1);
  });

  it("persists a checkpoint per user and device", async () => {
    const { persistence, service } = makeService(1_000);
    await persistence.appendEvent({
      type: "upsert",
      messageId: messageId(1),
      recipient: owner,
      sender,
      occurredAt: "2026-08-19T00:00:00.000Z",
      ciphertext: "aGVsbG8=",
    });
    await service.sync(owner, { deviceId });
    await expect(service.getCheckpoint(owner, deviceId)).resolves.toMatchObject({
      owner,
      deviceId,
      seq: 1,
    });
    await expect(service.getCheckpoint(owner, "other-device")).resolves.toBeNull();
  });

  it("recovers expired cursors through a bounded full resync", async () => {
    const { persistence } = makeService(1_000);
    const service = new MailboxSyncService(persistence, { now: () => 10_000 });
    await persistence.appendEvent({
      type: "upsert",
      messageId: messageId(1),
      recipient: owner,
      sender,
      occurredAt: "2026-08-19T00:00:00.000Z",
      ciphertext: "aGVsbG8=",
    });
    const expired = encodeMailboxCursor(owner, deviceId, 1, 1_000, 50);
    await expect(service.sync(owner, { deviceId, cursor: expired })).rejects.toMatchObject({
      code: "cursor_expired",
      status: 410,
    });
    const resync = await service.sync(owner, { deviceId });
    expect(resync.mode).toBe("initial");
    expect(resync.events).toHaveLength(1);
  });

  it("expires a cursor compacted out of the retained window", async () => {
    const { persistence, service } = makeService(1_000);
    for (let i = 1; i <= FULL_RESYNC_EVENT_BOUND + 5; i += 1) {
      await persistence.appendEvent({
        type: "upsert",
        messageId: messageId(i),
        recipient: owner,
        sender,
        occurredAt: "2026-08-19T00:00:00.000Z",
        ciphertext: "aGVsbG8=",
      });
    }
    const stale = encodeMailboxCursor(owner, deviceId, 1, 1_000);
    await expect(service.sync(owner, { deviceId, cursor: stale })).rejects.toBeInstanceOf(ApiError);
  });

  it("rejects malformed sync input", async () => {
    const { service } = makeService(1_000);
    await expect(service.sync(owner, { deviceId: "" })).rejects.toBeTruthy();
    await expect(
      service.sync(owner, { deviceId, limit: 0 } as { deviceId: string; limit: number }),
    ).rejects.toBeTruthy();
  });
});
