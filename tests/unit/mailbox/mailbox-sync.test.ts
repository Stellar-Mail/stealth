import { describe, expect, it, beforeEach } from "vitest";

import { MemoryApiRepository } from "@/server/api/memory-repository";
import { Route as MailboxSyncRoute } from "@/routes/api/v1/mailbox/sync";
import { Route as MailboxCountsRoute } from "@/routes/api/v1/mailbox/counts";
import { Route as MailboxMessageIdRoute } from "@/routes/api/v1/mailbox/$messageId";
import { type StoredEnvelope } from "@/server/api/domain";

const syncHandlers = MailboxSyncRoute.options.server!.handlers as any as {
  GET: (ctx: { request: Request }) => Promise<Response>;
};
const countsHandlers = MailboxCountsRoute.options.server!.handlers as any as {
  GET: (ctx: { request: Request }) => Promise<Response>;
};
const messageHandlers = MailboxMessageIdRoute.options.server!.handlers as any as {
  GET: (ctx: { request: Request; params: { messageId: string } }) => Promise<Response>;
  PATCH: (ctx: { request: Request; params: { messageId: string } }) => Promise<Response>;
  DELETE: (ctx: { request: Request; params: { messageId: string } }) => Promise<Response>;
};

const ALICE = `G${"A".repeat(55)}`;
const BOB = `G${"B".repeat(55)}`;
const MSG1 = "1111111111111111111111111111111111111111111111111111111111111111";
const MSG2 = "2222222222222222222222222222222222222222222222222222222222222222";
const MSG3 = "3333333333333333333333333333333333333333333333333333333333333333";

function makeEnvelope(overrides: Partial<StoredEnvelope>): StoredEnvelope {
  return {
    messageId: MSG1,
    senderId: BOB,
    recipientId: ALICE,
    ciphertext: "aGVsbG8=",
    protectedHeaders: { alg: "dir", enc: "A256GCM", version: "v1" },
    createdAt: new Date().toISOString(),
    status: "pending",
    ...overrides,
  };
}

describe("Live mailbox sync API (BETA-054)", () => {
  let repository: MemoryApiRepository;

  beforeEach(() => {
    process.env.STEALTH_CURSOR_SECRET = "test-cursor-secret-12345678901234567890";
    repository = new MemoryApiRepository();
    (globalThis as any).__stealthApiRepository = repository;
  });

  async function sync(url = "http://localhost/api/v1/mailbox/sync") {
    return syncHandlers.GET({
      request: new Request(url, { headers: { "x-stealth-address": ALICE } }),
    });
  }

  it("rejects unauthenticated sync and counts requests", async () => {
    const syncResponse = await syncHandlers.GET({
      request: new Request("http://localhost/api/v1/mailbox/sync"),
    });
    const countsResponse = await countsHandlers.GET({
      request: new Request("http://localhost/api/v1/mailbox/counts"),
    });
    expect(syncResponse.status).toBe(401);
    expect(countsResponse.status).toBe(401);
  });

  it("returns an empty first page with zero folder counts", async () => {
    const response = await sync();
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.data.items).toEqual([]);
    expect(json.data.hasMore).toBe(false);
    expect(json.data.counts).toEqual({
      inbox: 0,
      requests: 0,
      sent: 0,
      drafts: 0,
      outbox: 0,
      archive: 0,
      spam: 0,
      trash: 0,
      unread: 0,
      starred: 0,
    });
    expect(json.data.syncCursor).toEqual(expect.any(String));
  });

  it("pages the snapshot and keeps mailbox-wide counts accurate", async () => {
    await repository.insertEnvelope(
      makeEnvelope({ messageId: MSG1, createdAt: "2026-08-17T10:00:00Z" }),
    );
    await repository.insertEnvelope(
      makeEnvelope({ messageId: MSG2, createdAt: "2026-08-17T11:00:00Z", status: "delivered" }),
    );
    await repository.insertEnvelope(
      makeEnvelope({ messageId: MSG3, createdAt: "2026-08-17T12:00:00Z" }),
    );

    const first = await sync("http://localhost/api/v1/mailbox/sync?limit=2");
    const firstJson = await first.json();
    expect(first.status).toBe(200);
    expect(firstJson.data.items).toHaveLength(2);
    expect(firstJson.data.hasMore).toBe(true);
    expect(firstJson.data.counts.inbox).toBe(3);
    expect(firstJson.data.counts.unread).toBe(2);

    const second = await sync(
      `http://localhost/api/v1/mailbox/sync?limit=2&cursor=${encodeURIComponent(firstJson.data.nextCursor)}`,
    );
    const secondJson = await second.json();
    expect(secondJson.data.items).toHaveLength(1);
    expect(secondJson.data.hasMore).toBe(false);
    expect(secondJson.data.counts.inbox).toBe(3);
  });

  it("patches read/star/archive, then returns those rows on the next delta", async () => {
    await repository.insertEnvelope(
      makeEnvelope({ messageId: MSG1, createdAt: "2026-08-17T10:00:00Z" }),
    );
    const initial = await (await sync()).json();

    const patch = await messageHandlers.PATCH({
      request: new Request(`http://localhost/api/v1/mailbox/${MSG1}`, {
        method: "PATCH",
        headers: { "x-stealth-address": ALICE, "content-type": "application/json" },
        body: JSON.stringify({ unread: false, starred: true, folder: "archive" }),
      }),
      params: { messageId: MSG1 },
    });
    const patched = await patch.json();
    expect(patch.status).toBe(200);
    expect(patched.data.starred).toBe(true);
    expect(patched.data.unread).toBe(false);
    expect(patched.data.folder).toBe("archive");

    const counts = await countsHandlers.GET({
      request: new Request("http://localhost/api/v1/mailbox/counts", {
        headers: { "x-stealth-address": ALICE },
      }),
    });
    const countsJson = await counts.json();
    expect(countsJson.data.counts.archive).toBe(1);
    expect(countsJson.data.counts.starred).toBe(1);
    expect(countsJson.data.counts.unread).toBe(0);
    expect(countsJson.data.counts.inbox).toBe(0);

    const delta = await sync(
      `http://localhost/api/v1/mailbox/sync?sinceCursor=${encodeURIComponent(initial.data.syncCursor)}`,
    );
    const deltaJson = await delta.json();
    expect(
      deltaJson.data.items.some((item: { messageId: string }) => item.messageId === MSG1),
    ).toBe(true);
  });

  it("rejects another actor patching a message and conflicts on deleted mail", async () => {
    await repository.insertEnvelope(makeEnvelope({ messageId: MSG1 }));

    const forbidden = await messageHandlers.PATCH({
      request: new Request(`http://localhost/api/v1/mailbox/${MSG1}`, {
        method: "PATCH",
        headers: { "x-stealth-address": BOB, "content-type": "application/json" },
        body: JSON.stringify({ starred: true }),
      }),
      params: { messageId: MSG1 },
    });
    expect(forbidden.status).toBe(403);

    await messageHandlers.DELETE({
      request: new Request(`http://localhost/api/v1/mailbox/${MSG1}`, {
        method: "DELETE",
        headers: { "x-stealth-address": ALICE },
      }),
      params: { messageId: MSG1 },
    });

    const conflict = await messageHandlers.PATCH({
      request: new Request(`http://localhost/api/v1/mailbox/${MSG1}`, {
        method: "PATCH",
        headers: { "x-stealth-address": ALICE, "content-type": "application/json" },
        body: JSON.stringify({ folder: "inbox" }),
      }),
      params: { messageId: MSG1 },
    });
    const conflictJson = await conflict.json();
    expect(conflict.status).toBe(409);
    expect(conflictJson.error.code).toBe("conflict");
  });

  it("includes tombstoned ids in the incremental sync payload", async () => {
    await repository.insertEnvelope(
      makeEnvelope({ messageId: MSG1, createdAt: "2026-08-17T10:00:00Z" }),
    );
    const initial = await (await sync()).json();

    await messageHandlers.DELETE({
      request: new Request(`http://localhost/api/v1/mailbox/${MSG1}`, {
        method: "DELETE",
        headers: { "x-stealth-address": ALICE },
      }),
      params: { messageId: MSG1 },
    });

    const delta = await sync(
      `http://localhost/api/v1/mailbox/sync?sinceCursor=${encodeURIComponent(initial.data.syncCursor)}`,
    );
    const json = await delta.json();
    expect(json.data.deletedIds).toContain(MSG1);
    expect(json.data.counts.trash).toBe(1);
    expect(json.data.counts.inbox).toBe(0);
  });
});
