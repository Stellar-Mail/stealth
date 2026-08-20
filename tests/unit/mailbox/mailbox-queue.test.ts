import { describe, expect, it, beforeEach } from "vitest";

import { MemoryApiRepository } from "@/server/api/memory-repository";
import { type ApiContext } from "@/server/api/context";
import { encodeCursor } from "@/server/api/pagination";
import { Route as MailboxQueueRoute } from "@/routes/api/v1/mailbox/queue";
import { Route as MailboxMessageIdRoute } from "@/routes/api/v1/mailbox/$messageId";
import { MemoryRelayPersistence } from "@/services/relay/memory-persistence";
import { InProcessRelayWorker } from "@/services/relay/in-process-worker";
import { RelayService, type RelayServiceConfig } from "@/services/relay/relay-service";
import { handleRelayQueue } from "@/services/relay/transport";
import { type StoredEnvelope } from "@/server/api/domain";

// TanStack Start wraps server handlers in a `Constrain<…>` type that TypeScript
// cannot index directly. Cast once here so every call site stays readable.
const queueHandlers = MailboxQueueRoute.options.server!.handlers as any as {
  GET: (ctx: { request: Request }) => Promise<Response>;
};
const messageIdHandlers = MailboxMessageIdRoute.options.server!.handlers as any as {
  DELETE: (ctx: { request: Request; params: { messageId: string } }) => Promise<Response>;
};

const ALICE = `G${"A".repeat(55)}`;
const BOB = `G${"B".repeat(55)}`;
const CHARLIE = `G${"C".repeat(55)}`;

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

describe("Authenticated Recipient Mailbox Queue API (BETA-033)", () => {
  let repository: MemoryApiRepository;
  let mockContext: ApiContext;

  beforeEach(() => {
    process.env.STEALTH_CURSOR_SECRET = "test-cursor-secret-12345678901234567890";
    repository = new MemoryApiRepository();
    (globalThis as any).__stealthApiRepository = repository;
    mockContext = {
      repository,
      actorAddress: ALICE,
      isAuthenticated: true,
      principal: {
        address: ALICE,
        authMethod: "header",
      },
      env: {},
      requestId: "test-req-1",
      traceContext: {
        traceId: "trace-1",
        spanId: "span-1",
      },
    } as unknown as ApiContext;
  });

  describe("Recipient Isolation & Authorization", () => {
    it("returns only envelopes matching the authenticated recipient actor", async () => {
      await repository.insertEnvelope(
        makeEnvelope({ messageId: MSG1, recipientId: ALICE, createdAt: "2026-08-17T10:00:00Z" }),
      );
      await repository.insertEnvelope(
        makeEnvelope({ messageId: MSG2, recipientId: BOB, createdAt: "2026-08-17T10:05:00Z" }),
      );

      const request = new Request("http://localhost/api/v1/mailbox/queue", {
        headers: { "x-stealth-address": ALICE },
      });

      const response = await queueHandlers.GET({ request });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.items).toHaveLength(1);
      expect(json.data.items[0].messageId).toBe(MSG1);
      expect(json.data.items[0].recipientId).toBe(ALICE);
    });

    it("rejects request if specified recipient parameter does not match authenticated actor", async () => {
      const request = new Request(`http://localhost/api/v1/mailbox/queue?recipient=${BOB}`, {
        headers: { "x-stealth-address": ALICE },
      });

      const response = await queueHandlers.GET({ request });
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.error.code).toBe("forbidden");
    });

    it("rejects unauthenticated request missing x-stealth-address header", async () => {
      const request = new Request("http://localhost/api/v1/mailbox/queue");

      const response = await queueHandlers.GET({ request });
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.error.code).toBe("unauthorized");
    });
  });

  describe("Deterministic Cursor Pagination", () => {
    it("paginates envelopes deterministically in descending order of createdAt with messageId tiebreaker", async () => {
      await repository.insertEnvelope(
        makeEnvelope({ messageId: MSG1, recipientId: ALICE, createdAt: "2026-08-17T10:00:00Z" }),
      );
      await repository.insertEnvelope(
        makeEnvelope({ messageId: MSG2, recipientId: ALICE, createdAt: "2026-08-17T10:10:00Z" }),
      );
      await repository.insertEnvelope(
        makeEnvelope({ messageId: MSG3, recipientId: ALICE, createdAt: "2026-08-17T10:05:00Z" }),
      );

      // Page 1 with limit=2
      const req1 = new Request("http://localhost/api/v1/mailbox/queue?limit=2", {
        headers: { "x-stealth-address": ALICE },
      });
      const res1 = await queueHandlers.GET({
        request: req1,
      });
      const json1 = await res1.json();

      expect(json1.data.items).toHaveLength(2);
      expect(json1.data.items[0].messageId).toBe(MSG2); // newest (10:10)
      expect(json1.data.items[1].messageId).toBe(MSG3); // middle (10:05)
      expect(json1.data.hasMore).toBe(true);
      expect(json1.data.nextCursor).toBeTypeOf("string");

      // Page 2
      const req2 = new Request(
        `http://localhost/api/v1/mailbox/queue?limit=2&cursor=${encodeURIComponent(json1.data.nextCursor)}`,
        { headers: { "x-stealth-address": ALICE } },
      );
      const res2 = await queueHandlers.GET({
        request: req2,
      });
      const json2 = await res2.json();

      expect(json2.data.items).toHaveLength(1);
      expect(json2.data.items[0].messageId).toBe(MSG1); // oldest (10:00)
      expect(json2.data.hasMore).toBe(false);
      expect(json2.data.nextCursor).toBeNull();
    });

    it("rejects cursor signed for a different actor or tampered cursor", async () => {
      // 1. Cursor bound to a different actor
      const foreignCursor = encodeCursor(
        BOB,
        JSON.stringify(["2026-08-17T10:00:00Z", MSG1]),
        "mailbox_queue",
      );
      const req1 = new Request(
        `http://localhost/api/v1/mailbox/queue?cursor=${encodeURIComponent(foreignCursor)}`,
        { headers: { "x-stealth-address": ALICE } },
      );
      const res1 = await queueHandlers.GET({
        request: req1,
      });
      const json1 = await res1.json();
      expect(res1.status).toBe(403);
      expect(json1.error.code).toBe("forbidden");

      // 2. Tampered signature cursor
      const tamperedCursor =
        "1.badsignature.eyJrZXkiOiJmb28iLCJhY3RvciI6IkdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBIiwic2NvcGUiOiJtYWlsYm94X3F1ZXVlIn0";
      const req2 = new Request(
        `http://localhost/api/v1/mailbox/queue?cursor=${encodeURIComponent(tamperedCursor)}`,
        { headers: { "x-stealth-address": ALICE } },
      );
      const res2 = await queueHandlers.GET({
        request: req2,
      });
      const json2 = await res2.json();
      expect(res2.status).toBe(400);
      expect(json2.error.code).toBe("bad_request");
    });
  });

  describe("Status Filtering", () => {
    it("filters queue by status pending, delivered, or all", async () => {
      await repository.insertEnvelope(
        makeEnvelope({ messageId: MSG1, recipientId: ALICE, status: "pending" }),
      );
      await repository.insertEnvelope(
        makeEnvelope({ messageId: MSG2, recipientId: ALICE, status: "delivered" }),
      );

      // Pending only
      const reqPending = new Request("http://localhost/api/v1/mailbox/queue?status=pending", {
        headers: { "x-stealth-address": ALICE },
      });
      const resPending = await queueHandlers.GET({
        request: reqPending,
      });
      const jsonPending = await resPending.json();
      expect(jsonPending.data.items).toHaveLength(1);
      expect(jsonPending.data.items[0].messageId).toBe(MSG1);

      // Delivered only
      const reqDelivered = new Request("http://localhost/api/v1/mailbox/queue?status=delivered", {
        headers: { "x-stealth-address": ALICE },
      });
      const resDelivered = await queueHandlers.GET({
        request: reqDelivered,
      });
      const jsonDelivered = await resDelivered.json();
      expect(jsonDelivered.data.items).toHaveLength(1);
      expect(jsonDelivered.data.items[0].messageId).toBe(MSG2);

      // All
      const reqAll = new Request("http://localhost/api/v1/mailbox/queue?status=all", {
        headers: { "x-stealth-address": ALICE },
      });
      const resAll = await queueHandlers.GET({
        request: reqAll,
      });
      const jsonAll = await resAll.json();
      expect(jsonAll.data.items).toHaveLength(2);
    });
  });

  describe("Deletion Tombstones", () => {
    it("supports tombstoning an envelope and excluding it by default", async () => {
      await repository.insertEnvelope(makeEnvelope({ messageId: MSG1, recipientId: ALICE }));

      // Delete message
      const delReq = new Request(`http://localhost/api/v1/mailbox/${MSG1}`, {
        method: "DELETE",
        headers: { "x-stealth-address": ALICE },
      });
      const delRes = await messageIdHandlers.DELETE({
        request: delReq,
        params: { messageId: MSG1 },
      });
      const delJson = await delRes.json();

      expect(delRes.status).toBe(200);
      expect(delJson.data.isTombstone).toBe(true);
      expect(delJson.data.deletedAt).toBeTypeOf("string");

      // Default query excludes tombstone
      const qReq1 = new Request("http://localhost/api/v1/mailbox/queue", {
        headers: { "x-stealth-address": ALICE },
      });
      const qRes1 = await queueHandlers.GET({
        request: qReq1,
      });
      const qJson1 = await qRes1.json();
      expect(qJson1.data.items).toHaveLength(0);

      // Query with includeTombstones=true returns tombstone
      const qReq2 = new Request("http://localhost/api/v1/mailbox/queue?includeTombstones=true", {
        headers: { "x-stealth-address": ALICE },
      });
      const qRes2 = await queueHandlers.GET({
        request: qReq2,
      });
      const qJson2 = await qRes2.json();
      expect(qJson2.data.items).toHaveLength(1);
      expect(qJson2.data.items[0].isTombstone).toBe(true);
      expect(qJson2.data.items[0].deletedAt).toBeTypeOf("string");
    });

    it("prevents Bob from tombstoning Alice's envelope", async () => {
      await repository.insertEnvelope(makeEnvelope({ messageId: MSG1, recipientId: ALICE }));

      const delReq = new Request(`http://localhost/api/v1/mailbox/${MSG1}`, {
        method: "DELETE",
        headers: { "x-stealth-address": BOB },
      });

      const delRes = await messageIdHandlers.DELETE({
        request: delReq,
        params: { messageId: MSG1 },
      });
      const delJson = await delRes.json();

      expect(delRes.status).toBe(403);
      expect(delJson.error.code).toBe("forbidden");
    });
  });

  describe("Relay Service Queue Integration", () => {
    it("queries relay service queue scoped to recipient actor", async () => {
      const persistence = new MemoryRelayPersistence();
      const worker = new InProcessRelayWorker(persistence);
      const config: RelayServiceConfig = {
        serviceName: "stealth-relay",
        version: "test-build",
        apiVersion: "v1",
        protocolVersion: "v1",
        timeoutMs: 1000,
        network: {
          horizonUrl: "https://horizon-testnet.stellar.org",
          sorobanRpcUrl: "https://soroban-testnet.stellar.org",
          networkPassphrase: "Test SDF Network ; September 2015",
        },
      };
      const service = new RelayService(persistence, worker, config);

      await persistence.enqueue({
        messageId: MSG1,
        sender: BOB,
        recipient: ALICE,
        recipientDomain: "example.com",
        payload: "encrypted-payload",
        ttlMs: 3600000,
        receivedAt: new Date().toISOString(),
      });

      await persistence.enqueue({
        messageId: MSG2,
        sender: CHARLIE,
        recipient: BOB,
        recipientDomain: "example.com",
        payload: "encrypted-payload-2",
        ttlMs: 3600000,
        receivedAt: new Date().toISOString(),
      });

      // Test transport handler for Alice
      const reqAlice = new Request("http://localhost/relay/messages", {
        headers: { "x-stealth-address": ALICE },
      });
      const resAlice = await handleRelayQueue(reqAlice, service, ALICE);
      const jsonAlice = await resAlice.json();

      expect(resAlice.status).toBe(200);
      expect(jsonAlice.data.items).toHaveLength(1);
      expect(jsonAlice.data.items[0].messageId).toBe(MSG1);

      // Test mismatched actor rejection
      const reqMismatch = new Request("http://localhost/relay/messages", {
        headers: { "x-stealth-address": CHARLIE },
      });
      const resMismatch = await handleRelayQueue(reqMismatch, service, ALICE);
      const jsonMismatch = await resMismatch.json();

      expect(resMismatch.status).toBe(403);
      expect(jsonMismatch.error.code).toBe("forbidden");
    });
  });
});
