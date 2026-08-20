import { describe, expect, it } from "vitest";

import { applySyncEvents } from "../../../src/features/mail/apply-events";
import { mergeLiveMailboxMessages } from "../../../src/features/mail/merge-live";
import {
  createMemoryCheckpointStore,
  loadCheckpoint,
} from "../../../src/features/mail/sync-checkpoint";
import { MailboxSyncEngine, alwaysVisible, MemoryTabLock } from "../../../src/features/mail/sync-engine";
import { MailboxSyncError, type MailboxSyncEvent, type MailboxSyncResult } from "../../../src/features/mail/types";

const actor = `G${"A".repeat(55)}`;
const recipient = actor;

function event(seq: number, type: MailboxSyncEvent["type"] = "upsert"): MailboxSyncEvent {
  return {
    seq,
    type,
    messageId: seq.toString(16).padStart(64, "0"),
    occurredAt: "2026-08-19T00:00:00.000Z",
    recipient,
    sender: `G${"B".repeat(55)}`,
    ciphertext: "aGVsbG8=",
  };
}

function result(events: MailboxSyncEvent[], cursor: string, hasMore = false): MailboxSyncResult {
  return { mode: cursor === "c0" ? "initial" : "delta", events, cursor, hasMore };
}

describe("applySyncEvents", () => {
  it("fills an out-of-order page once missing seqs arrive", () => {
    const first = applySyncEvents(new Map(), [event(1), event(2)], 0);
    expect(first.appliedSeq).toBe(2);
    const gapped = applySyncEvents(first.messages, [event(4)], first.appliedSeq);
    expect(gapped.appliedSeq).toBe(2);
    expect(gapped.skipped).toBe(1);
    const filled = applySyncEvents(gapped.messages, [event(3), event(4)], gapped.appliedSeq);
    expect(filled.appliedSeq).toBe(4);
    expect(filled.messages.size).toBe(4);
  });

  it("applies deletions via tombstones", () => {
    const upserted = applySyncEvents(new Map(), [event(1)], 0);
    const deleted = applySyncEvents(upserted.messages, [{ ...event(2, "tombstone"), messageId: event(1).messageId }], 1);
    expect(deleted.messages.size).toBe(0);
  });
});

describe("MailboxSyncEngine", () => {
  it("does not duplicate messages across reconnects", async () => {
    const store = createMemoryCheckpointStore();
    let calls = 0;
    const fetchSync = async () => {
      calls += 1;
      if (calls === 1) return result([event(1), event(2)], "c1");
      return result([], "c1");
    };
    const engine = new MailboxSyncEngine({
      actor,
      store,
      fetchSync,
      visibility: alwaysVisible(),
      createDeviceId: () => "device-one",
    });
    await engine.syncOnce();
    await engine.syncOnce();
    expect(engine.messages.size).toBe(2);
    expect(engine.appliedSeq).toBe(2);
    expect(loadCheckpoint(store, actor, "device-one")?.cursor).toBe("c1");
  });

  it("recovers from an expired cursor with a bounded full resync", async () => {
    const store = createMemoryCheckpointStore();
    let calls = 0;
    const fetchSync = async (input: { cursor?: string | null }) => {
      calls += 1;
      if (input.cursor === "stale") {
        throw new MailboxSyncError(410, "cursor_expired", "expired", false);
      }
      return result([event(8)], "c-new");
    };
    const engine = new MailboxSyncEngine({
      actor,
      store,
      fetchSync,
      visibility: alwaysVisible(),
      createDeviceId: () => "device-one",
    });
    engine.cursor = "stale";
    engine.appliedSeq = 7;
    engine.messages.set(event(1).messageId, {
      messageId: event(1).messageId,
      recipient,
      occurredAt: "2026-08-19T00:00:00.000Z",
      unread: true,
      starred: false,
      folder: "inbox",
    });
    await engine.syncOnce();
    expect(calls).toBe(2);
    expect(engine.cursor).toBe("c-new");
    expect(engine.messages.has(event(8).messageId)).toBe(true);
    expect(engine.messages.has(event(1).messageId)).toBe(false);
  });

  it("honors abort and does not continue polling", async () => {
    const store = createMemoryCheckpointStore();
    let fetches = 0;
    const engine = new MailboxSyncEngine({
      actor,
      store,
      fetchSync: async ({ signal }) => {
        fetches += 1;
        signal?.throwIfAborted();
        return result([event(1)], "c1");
      },
      pollIntervalMs: 20,
      visibility: alwaysVisible(),
      sleep: (ms, signal) =>
        new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, ms);
          signal.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
          });
        }),
      createDeviceId: () => "device-one",
    });
    engine.start();
    await new Promise((resolve) => setTimeout(resolve, 15));
    await engine.stop();
    const afterStop = fetches;
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(fetches).toBe(afterStop);
  });

  it("pauses while hidden and resumes when visible", async () => {
    const store = createMemoryCheckpointStore();
    let hidden = true;
    const listeners: Array<() => void> = [];
    let fetches = 0;
    const engine = new MailboxSyncEngine({
      actor,
      store,
      fetchSync: async () => {
        fetches += 1;
        return result([], "c1");
      },
      pollIntervalMs: 5,
      visibility: {
        get hidden() {
          return hidden;
        },
        subscribe(listener) {
          listeners.push(listener);
          return () => undefined;
        },
      },
      sleep: async () => undefined,
      createDeviceId: () => "device-one",
    });
    engine.start();
    await new Promise((resolve) => setTimeout(resolve, 15));
    expect(fetches).toBe(0);
    hidden = false;
    listeners.forEach((listener) => listener());
    await new Promise((resolve) => setTimeout(resolve, 15));
    await engine.stop();
    expect(fetches).toBeGreaterThan(0);
  });

  it("shares a checkpoint across concurrent tabs without duplicating applies", async () => {
    const store = createMemoryCheckpointStore();
    let fetches = 0;
    const fetchSync = async () => {
      fetches += 1;
      return result([event(1)], "c1");
    };
    const first = new MailboxSyncEngine({
      actor,
      store,
      fetchSync,
      visibility: alwaysVisible(),
      createDeviceId: () => "shared-device",
      tabLock: new MemoryTabLock(),
    });
    const second = new MailboxSyncEngine({
      actor,
      store,
      fetchSync,
      visibility: alwaysVisible(),
      createDeviceId: () => "shared-device",
      tabLock: new MemoryTabLock(),
    });
    await Promise.all([first.syncOnce(), second.syncOnce()]);
    expect(fetches).toBeGreaterThanOrEqual(1);
    expect(first.messages.size).toBe(1);
    expect(second.messages.size).toBe(1);
    expect(first.appliedSeq).toBe(1);
    expect(second.appliedSeq).toBe(1);
  });

  it("backs off after a transient failure", async () => {
    const store = createMemoryCheckpointStore();
    const sleeps: number[] = [];
    let attempts = 0;
    const engine = new MailboxSyncEngine({
      actor,
      store,
      fetchSync: async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new MailboxSyncError(503, "dependency_unavailable", "down", true);
        }
        return result([event(1)], "c1");
      },
      pollIntervalMs: 1,
      visibility: alwaysVisible(),
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      createDeviceId: () => "device-one",
    });
    engine.start();
    await new Promise((resolve) => setTimeout(resolve, 30));
    await engine.stop();
    expect(sleeps[0]).toBeGreaterThanOrEqual(1_000);
    expect(engine.messages.size).toBe(1);
  });
});

describe("mergeLiveMailboxMessages", () => {
  it("does not duplicate seeded mail when live ids differ", () => {
    const seeded = [
      {
        id: "1",
        from: "Ada",
        email: "ada@example.test",
        subject: "Seeded",
        preview: "p",
        body: "b",
        time: "Now",
        unread: false,
        starred: false,
        folder: "inbox" as const,
        avatarColor: "#fff",
      },
    ];
    const live = [
      {
        messageId: "a".repeat(64),
        recipient: actor,
        occurredAt: "2026-08-19T00:00:00.000Z",
        unread: true,
        starred: false,
        folder: "inbox",
      },
    ];
    const merged = mergeLiveMailboxMessages(seeded, live);
    expect(merged.map((email) => email.id)).toEqual(["1", "a".repeat(64)]);
  });
});
