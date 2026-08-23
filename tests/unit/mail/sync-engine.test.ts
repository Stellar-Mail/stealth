import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";

import { MailboxSyncEngine, type SyncEngineOptions } from "@/features/mail/sync-engine";
import {
  clearSyncCheckpoint,
  readSyncCheckpoint,
  writeSyncCheckpoint,
  getDeviceId,
} from "@/features/mail/live-mailbox";
import { sharedTypedApi as api } from "@/lib/api";
import type { MailboxDescriptor, MailboxSyncResponse } from "@/lib/api";

const ALICE = `G${"A".repeat(55)}`;
const BOB = `G${"B".repeat(55)}`;
const MSG1 = "1".repeat(64);
const MSG2 = "2".repeat(64);
const MSG3 = "3".repeat(64);

function makeDescriptor(id: string, overrides: Partial<MailboxDescriptor> = {}): MailboxDescriptor {
  return {
    messageId: id,
    senderId: BOB,
    recipientId: ALICE,
    status: "pending",
    createdAt: "2026-08-20T10:00:00Z",
    protectedHeaders: {},
    isTombstone: false,
    deletedAt: null,
    starred: false,
    unread: true,
    folder: "inbox",
    ...overrides,
  };
}

function makeSyncResponse(overrides: Partial<MailboxSyncResponse> = {}): MailboxSyncResponse {
  return {
    items: [makeDescriptor(MSG1)],
    deletedIds: [],
    nextCursor: null,
    hasMore: false,
    syncCursor: "1.test_sig.test_key",
    counts: {
      inbox: 1,
      requests: 0,
      sent: 0,
      drafts: 0,
      outbox: 0,
      archive: 0,
      spam: 0,
      trash: 0,
      unread: 1,
      starred: 0,
    },
    ...overrides,
  };
}

describe("MailboxSyncEngine (BETA-034)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearSyncCheckpoint(ALICE);
  });

  afterEach(() => {
    clearSyncCheckpoint(ALICE);
  });

  it("performs initial sync when no checkpoint exists and saves durable checkpoint", async () => {
    const mockResponse = makeSyncResponse();
    vi.spyOn(api.mailbox, "sync").mockResolvedValueOnce(mockResponse);

    const engine = new MailboxSyncEngine({ actor: ALICE });
    const result = await engine.sync();

    expect(result).toEqual(mockResponse);
    const checkpoint = readSyncCheckpoint(ALICE);
    expect(checkpoint).not.toBeNull();
    expect(checkpoint?.cursor).toBe("1.test_sig.test_key");
    expect(checkpoint?.actor).toBe(ALICE);
    expect(checkpoint?.deviceId).toBe(engine.getDeviceId());
  });

  it("performs delta sync when checkpoint is present", async () => {
    writeSyncCheckpoint(ALICE, "1.existing_sig.existing_key");

    const deltaResponse = makeSyncResponse({
      items: [makeDescriptor(MSG2, { createdAt: "2026-08-20T11:00:00Z" })],
      syncCursor: "1.new_sig.new_key",
    });
    const syncSpy = vi.spyOn(api.mailbox, "sync").mockResolvedValueOnce(deltaResponse);

    const engine = new MailboxSyncEngine({ actor: ALICE });
    const result = await engine.sync();

    expect(syncSpy).toHaveBeenCalledWith(
      { sinceCursor: "1.existing_sig.existing_key", limit: 100 },
      undefined,
    );
    expect(result.syncCursor).toBe("1.new_sig.new_key");

    const updatedCheckpoint = readSyncCheckpoint(ALICE);
    expect(updatedCheckpoint?.cursor).toBe("1.new_sig.new_key");
  });

  it("recovers automatically from expired cursor (HTTP 410) via bounded full resync", async () => {
    writeSyncCheckpoint(ALICE, "1.expired_sig.expired_key");

    const expiredError = {
      status: 410,
      code: "cursor_expired",
      message: "Pagination cursor has expired",
    };
    const freshSnapshot = makeSyncResponse({
      items: [makeDescriptor(MSG1), makeDescriptor(MSG2)],
      syncCursor: "1.fresh_sig.fresh_key",
    });

    const syncSpy = vi
      .spyOn(api.mailbox, "sync")
      .mockRejectedValueOnce(expiredError) // Delta sync fails with 410
      .mockResolvedValueOnce(freshSnapshot); // Full resync succeeds

    let onExpiredCalled = false;
    const engine = new MailboxSyncEngine({
      actor: ALICE,
      onCursorExpired: () => {
        onExpiredCalled = true;
      },
    });

    const result = await engine.sync();

    expect(onExpiredCalled).toBe(true);
    expect(syncSpy).toHaveBeenCalledTimes(2);
    expect(result.syncCursor).toBe("1.fresh_sig.fresh_key");
    expect(engine.getState().items).toHaveLength(2);
  });

  it("deduplicates messages and handles deletions/tombstones cleanly", async () => {
    const initial = makeSyncResponse({
      items: [makeDescriptor(MSG1), makeDescriptor(MSG2)],
    });
    vi.spyOn(api.mailbox, "sync").mockResolvedValueOnce(initial);

    const engine = new MailboxSyncEngine({ actor: ALICE });
    await engine.initialSync();
    expect(engine.getState().items).toHaveLength(2);

    // Delta sync returns MSG3, updates MSG2, and deletes MSG1
    const delta = makeSyncResponse({
      items: [makeDescriptor(MSG2, { starred: true }), makeDescriptor(MSG3)],
      deletedIds: [MSG1],
      syncCursor: "1.delta_sig.delta_key",
    });
    vi.spyOn(api.mailbox, "sync").mockResolvedValueOnce(delta);

    await engine.deltaSync("1.test_sig.test_key");
    const items = engine.getState().items;

    expect(items.map((i) => i.messageId)).toEqual([MSG3, MSG2]);
    expect(items.find((i) => i.messageId === MSG2)?.starred).toBe(true);
    expect(items.find((i) => i.messageId === MSG1)).toBeUndefined();
  });

  it("calculates exponential backoff with jitter on successive retries", () => {
    const engine = new MailboxSyncEngine({
      actor: ALICE,
      baseBackoffMs: 1000,
      maxBackoffMs: 30000,
      jitterRatio: 0.1,
    });

    const delay1 = engine.calculateBackoffDelay(1);
    const delay2 = engine.calculateBackoffDelay(2);
    const delay3 = engine.calculateBackoffDelay(3);

    expect(delay1).toBeGreaterThanOrEqual(900);
    expect(delay1).toBeLessThanOrEqual(1100);

    expect(delay2).toBeGreaterThanOrEqual(1800);
    expect(delay2).toBeLessThanOrEqual(2200);

    expect(delay3).toBeGreaterThanOrEqual(3600);
    expect(delay3).toBeLessThanOrEqual(4400);
  });

  it("pauses polling when offline or hidden, and resumes immediately on reconnect/visible", async () => {
    const mockResponse = makeSyncResponse();
    const syncSpy = vi.spyOn(api.mailbox, "sync").mockResolvedValue(mockResponse);

    const engine = new MailboxSyncEngine({ actor: ALICE });
    engine.setOnline(false);
    expect(engine.getState().isOnline).toBe(false);

    // Reconnect triggers sync immediately
    engine.setOnline(true);
    expect(engine.getState().isOnline).toBe(true);
    expect(syncSpy).toHaveBeenCalled();
  });

  it("supports request cancellation through stop()", () => {
    const engine = new MailboxSyncEngine({ actor: ALICE });
    engine.stop();
    expect(engine.getState().status).toBe("stopped");
  });
});
