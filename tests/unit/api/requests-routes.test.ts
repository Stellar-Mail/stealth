import { beforeEach, describe, expect, it } from "vitest";

import { MemoryApiRepository } from "@/server/api/memory-repository";
import { Route as RequestsRoute } from "@/routes/api/v1/requests/index";
import { Route as DecisionsRoute } from "@/routes/api/v1/requests/$requestId/decisions";
import { ACTOR_HEADER } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { createSenderRequest } from "@/server/api/sender-request-service";
import type { StoredEnvelope } from "@/server/api/domain";

const recipient = `G${"A".repeat(55)}`;
const sender = `G${"B".repeat(55)}`;

const getHandler = (RequestsRoute.options as any).server?.handlers?.GET;
const postHandler = (DecisionsRoute.options as any).server?.handlers?.POST;

function request(path: string, method: string, actor?: string, body?: unknown) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (actor !== undefined) headers[ACTOR_HEADER] = actor;
  const init: RequestInit = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);
  return new Request(`https://stealth.test${path}`, init);
}

describe("Requests and Decisions API Routes", () => {
  let repository: MemoryApiRepository;

  beforeEach(async () => {
    process.env.STEALTH_CURSOR_SECRET = "test-secret-value-for-triage-board-route-unit-tests";
    const ctx = await getApiContext();
    repository = ctx.repository as MemoryApiRepository;
    repository.reset?.();
  });

  describe("GET /api/v1/requests", () => {
    it("returns paginated unknown sender requests with details", async () => {
      // Setup: Insert 3 pending requests
      for (let i = 1; i <= 3; i++) {
        const messageId = `msg-${i}`;
        const requestId = `00000000-0000-4000-8000-00000000000${i}`;

        const reqRecord = {
          requestId,
          recipient,
          sender,
          message: { messageId, ciphertextHash: `hash-${i}` },
          createdAt: new Date(Date.now() - i * 1000).toISOString(),
          expiresAt: new Date(Date.now() + 100000).toISOString(),
          status: "pending" as const,
        };
        await createSenderRequest(repository, reqRecord);

        // Set envelope
        const envelope: StoredEnvelope = {
          messageId,
          recipientId: recipient,
          senderId: sender,
          status: "pending",
          createdAt: new Date().toISOString(),
          ciphertext: "abc",
          protectedHeaders: {
            version: "1.0",
            algorithm: "Ed25519",
            ephemeralPublicKey: "ephemeral",
            recipientPublicKey: "recipient",
            senderPublicKey: "sender",
            nonce: "nonce",
            ciphertextHash: "hash",
          },
        };
        await repository.insertEnvelope(envelope);

        // Set postage & anchor
        await repository.setPostage({
          recipient,
          sender,
          messageId,
          amount: "50000000",
          paymentHash: `hash-${i}`,
          status: "settled",
          createdAt: new Date().toISOString(),
        });
        await repository.setLifecycleAnchor({
          recipient,
          sender,
          messageId,
          status: "confirmed" as const,
          amount: "50000000",
          verified: true,
          receiptRequired: false,
          scheduledAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          failureCount: 0,
          lastError: null,
          txHash: null,
        });
      }

      // Fetch first page with limit = 2
      const req1 = request("/api/v1/requests?limit=2", "GET", recipient);
      const res1 = await getHandler({ request: req1 });
      const json1 = await res1.json();
      if (res1.status !== 200) {
        console.error("GET Requests failed with 500. Error details:", json1);
      }
      expect(res1.status).toBe(200);
      expect(json1.data.items).toHaveLength(2);
      expect(json1.data.hasMore).toBe(true);
      expect(json1.data.nextCursor).toBeDefined();

      // Check enriched fields
      const first = json1.data.items[0];
      expect(first.postageAmount).toBe("50000000");
      expect(first.verifiedSender).toBe(true);
      expect(first.proofSummary).toContain("hash-");

      // Fetch second page using cursor
      const req2 = request(
        `/api/v1/requests?limit=2&cursor=${encodeURIComponent(json1.data.nextCursor)}`,
        "GET",
        recipient,
      );
      const res2 = await getHandler({ request: req2 });
      expect(res2.status).toBe(200);

      const json2 = await res2.json();
      expect(json2.data.items).toHaveLength(1);
      expect(json2.data.hasMore).toBe(false);
      expect(json2.data.nextCursor).toBeNull();
    });
  });

  describe("POST /api/v1/requests/:requestId/decisions", () => {
    it("handles always_allow decision, updating policy and envelope status", async () => {
      const messageId = "msg-allow";
      const requestId = "00000000-0000-4000-8000-000000000010";

      const reqRecord = {
        requestId,
        recipient,
        sender,
        message: { messageId, ciphertextHash: "hash-allow" },
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 100000).toISOString(),
        status: "pending" as const,
      };
      await createSenderRequest(repository, reqRecord);

      const envelope: StoredEnvelope = {
        messageId,
        recipientId: recipient,
        senderId: sender,
        status: "pending",
        createdAt: new Date().toISOString(),
        ciphertext: "abc",
        protectedHeaders: {
          version: "1.0",
          algorithm: "Ed25519",
          ephemeralPublicKey: "ephemeral",
          recipientPublicKey: "recipient",
          senderPublicKey: "sender",
          nonce: "nonce",
          ciphertextHash: "hash",
        },
      };
      await repository.insertEnvelope(envelope);

      const req = request(`/api/v1/requests/${requestId}/decisions`, "POST", recipient, {
        decision: "always_allow",
      });
      const res = await postHandler({
        request: req,
        params: { requestId },
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.status).toBe("approved");
      expect(json.data.decision).toBe("always_allow");

      // Verify rule is set to allow
      const rule = await repository.getSenderRule(recipient, sender);
      expect(rule).toBe("allow");

      // Verify envelope status is transitioned to delivered
      const env = await repository.getEnvelope(messageId);
      expect(env?.status).toBe("delivered");
    });

    it("handles block decision, setting rule and tombstones envelope", async () => {
      const messageId = "msg-block";
      const requestId = "00000000-0000-4000-8000-000000000011";

      const reqRecord = {
        requestId,
        recipient,
        sender,
        message: { messageId, ciphertextHash: "hash-block" },
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 100000).toISOString(),
        status: "pending" as const,
      };
      await createSenderRequest(repository, reqRecord);

      const envelope: StoredEnvelope = {
        messageId,
        recipientId: recipient,
        senderId: sender,
        status: "pending",
        createdAt: new Date().toISOString(),
        ciphertext: "abc",
        protectedHeaders: {
          version: "1.0",
          algorithm: "Ed25519",
          ephemeralPublicKey: "ephemeral",
          recipientPublicKey: "recipient",
          senderPublicKey: "sender",
          nonce: "nonce",
          ciphertextHash: "hash",
        },
      };
      await repository.insertEnvelope(envelope);

      const req = request(`/api/v1/requests/${requestId}/decisions`, "POST", recipient, {
        decision: "block",
      });
      const res = await postHandler({
        request: req,
        params: { requestId },
      });
      expect(res.status).toBe(200);

      // Verify rule is block
      const rule = await repository.getSenderRule(recipient, sender);
      expect(rule).toBe("block");

      // Verify envelope is tombstoned
      const env = await repository.getEnvelope(messageId);
      expect(env?.deletedAt).toBeDefined();
    });
  });
});
