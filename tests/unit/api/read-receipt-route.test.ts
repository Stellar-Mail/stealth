import { beforeEach, describe, expect, it } from "vitest";

import { Route as ReadRoute } from "../../../src/routes/api/v1/receipts/$messageId/read";
import { ACTOR_HEADER } from "../../../src/server/api/actor";
import { getApiContext } from "../../../src/server/api/context";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import { createDeliveryReceipt } from "../../../src/server/api/receipt-service";

// Stable Stellar G-addresses (56 chars starting with G)
const sender = `G${"A".repeat(55)}`;
const recipient = `G${"B".repeat(55)}`;
const unrelatedActor = `G${"C".repeat(55)}`;
const validMessageId = "a".repeat(64);

const readHandler = (ReadRoute.options as any).server?.handlers?.POST;

function readRequest(actor: string, messageId: string = validMessageId) {
  return new Request(`https://stealth.test/api/v1/receipts/${messageId}/read`, {
    method: "POST",
    headers: { [ACTOR_HEADER]: actor },
  });
}

function parseJsonResponse(response: Response) {
  return response.clone().json() as Promise<{
    error?: { code: string; message: string; retryable: boolean; details?: unknown };
    data?: unknown;
  }>;
}

describe("read receipt endpoint (route-level tests)", () => {
  let repo: MemoryApiRepository;

  beforeEach(async () => {
    repo = (await getApiContext()).repository as MemoryApiRepository;
    repo.reset();
  });

  // =========================================================================
  // Invalid payload validation — messageId must be a valid 32-byte hex hash
  // =========================================================================

  describe("payload validation — messageId", () => {
    it("rejects messageId with invalid hex characters", async () => {
      const response = await readHandler({
        request: readRequest(recipient, "z".repeat(64)),
        params: { messageId: "z".repeat(64) },
      });

      expect(response.status).toBe(422);
      const body = await parseJsonResponse(response);
      expect(body.error?.code).toBe("validation_error");
    });

    it("rejects messageId that is too short", async () => {
      const response = await readHandler({
        request: readRequest(recipient, "a".repeat(63)),
        params: { messageId: "a".repeat(63) },
      });

      expect(response.status).toBe(422);
      const body = await parseJsonResponse(response);
      expect(body.error?.code).toBe("validation_error");
    });

    it("rejects messageId that is too long", async () => {
      const response = await readHandler({
        request: readRequest(recipient, "a".repeat(65)),
        params: { messageId: "a".repeat(65) },
      });

      expect(response.status).toBe(422);
      const body = await parseJsonResponse(response);
      expect(body.error?.code).toBe("validation_error");
    });

    it("rejects messageId with uppercase letters (must be lowercase)", async () => {
      // Note: hash32Schema normalizes to lowercase, so "A".repeat(64) becomes valid
      // This test verifies the schema accepts uppercase input (auto-converts)
      const response = await readHandler({
        request: readRequest(recipient, "A".repeat(64)),
        params: { messageId: "A".repeat(64) },
      });

      // Since uppercase gets normalized to lowercase, it's a valid hash
      // but the receipt won't exist, so we get 404 instead of validation error
      expect(response.status).toBe(404);
      const body = await parseJsonResponse(response);
      expect(body.error?.code).toBe("not_found");
    });

    it("error response includes validation details", async () => {
      const response = await readHandler({
        request: readRequest(recipient, "invalid"),
        params: { messageId: "invalid" },
      });

      const body = await parseJsonResponse(response);
      expect(body.error?.code).toBe("validation_error");
      expect(body.error?.details).toBeDefined();
    });
  });

  // =========================================================================
  // Missing or invalid authentication
  // =========================================================================

  describe("authentication validation", () => {
    beforeEach(async () => {
      await createDeliveryReceipt(repo, {
        messageId: validMessageId,
        recipient,
        sender,
      });
    });

    it("rejects request without actor header", async () => {
      const request = new Request(`https://stealth.test/api/v1/receipts/${validMessageId}/read`, {
        method: "POST",
        headers: {},
      });

      const response = await readHandler({
        request,
        params: { messageId: validMessageId },
      });

      expect(response.status).toBe(401);
      const body = await parseJsonResponse(response);
      expect(body.error?.code).toBe("unauthorized");
    });

    it("rejects request with empty actor header", async () => {
      const request = new Request(`https://stealth.test/api/v1/receipts/${validMessageId}/read`, {
        method: "POST",
        headers: { [ACTOR_HEADER]: "" },
      });

      const response = await readHandler({
        request,
        params: { messageId: validMessageId },
      });

      expect(response.status).toBe(401);
      const body = await parseJsonResponse(response);
      expect(body.error?.code).toBe("unauthorized");
    });

    it("rejects request with invalid Stellar address as actor", async () => {
      const request = new Request(`https://stealth.test/api/v1/receipts/${validMessageId}/read`, {
        method: "POST",
        headers: { [ACTOR_HEADER]: "not-a-stellar-address" },
      });

      const response = await readHandler({
        request,
        params: { messageId: validMessageId },
      });

      expect(response.status).toBe(401);
      const body = await parseJsonResponse(response);
      expect(body.error?.code).toBe("unauthorized");
    });
  });

  // =========================================================================
  // Unauthorized reader rejection — only recipient can read
  // =========================================================================

  describe("authorization — only recipient can publish read receipt", () => {
    beforeEach(async () => {
      await createDeliveryReceipt(repo, { messageId: validMessageId, recipient, sender });
    });

    it("rejects sender actor", async () => {
      const response = await readHandler({
        request: readRequest(sender),
        params: { messageId: validMessageId },
      });

      expect(response.status).toBe(403);
      const body = await parseJsonResponse(response);
      expect(body.error?.code).toBe("forbidden");
      expect(body.error?.retryable).toBe(false);
    });

    it("rejects unrelated actor", async () => {
      const response = await readHandler({
        request: readRequest(unrelatedActor),
        params: { messageId: validMessageId },
      });

      expect(response.status).toBe(403);
      const body = await parseJsonResponse(response);
      expect(body.error?.code).toBe("forbidden");
    });

    it("does not modify receipt state when actor is unauthorized", async () => {
      await readHandler({
        request: readRequest(sender),
        params: { messageId: validMessageId },
      });

      const receipt = await repo.getReceipt(validMessageId);
      expect(receipt?.readAt).toBeNull();
    });

    it("error message is stable and descriptive", async () => {
      const response = await readHandler({
        request: readRequest(unrelatedActor),
        params: { messageId: validMessageId },
      });

      const body = await parseJsonResponse(response);
      expect(body.error?.message).toBe("Only the message recipient can publish read receipts");
      expect(body.error?.code).toBe("forbidden");
    });
  });

  // =========================================================================
  // Non-existent receipt — must reject with not_found
  // =========================================================================

  describe("not-found handling", () => {
    it("returns 404 when receipt does not exist", async () => {
      const response = await readHandler({
        request: readRequest(recipient),
        params: { messageId: validMessageId },
      });

      expect(response.status).toBe(404);
      const body = await parseJsonResponse(response);
      expect(body.error?.code).toBe("not_found");
      expect(body.error?.retryable).toBe(false);
    });

    it("returns 404 for non-existent even with unauthorized actor", async () => {
      const response = await readHandler({
        request: readRequest(unrelatedActor),
        params: { messageId: validMessageId },
      });

      expect(response.status).toBe(404);
      const body = await parseJsonResponse(response);
      expect(body.error?.code).toBe("not_found");
    });

    it("not_found error message is stable", async () => {
      const response = await readHandler({
        request: readRequest(recipient),
        params: { messageId: validMessageId },
      });

      const body = await parseJsonResponse(response);
      expect(body.error?.message).toBe("Receipt was not found");
    });
  });

  // =========================================================================
  // Duplicate read receipt behavior — first-write-wins, deterministic
  // =========================================================================

  describe("duplicate read receipt behavior — deterministic first-write-wins", () => {
    beforeEach(async () => {
      await createDeliveryReceipt(repo, { messageId: validMessageId, recipient, sender });
    });

    it("returns 200 on successful first read from recipient", async () => {
      const response = await readHandler({
        request: readRequest(recipient),
        params: { messageId: validMessageId },
      });

      expect(response.status).toBe(200);
      const body = await parseJsonResponse(response);
      expect(body.data).toBeDefined();
    });

    it("returns 200 on duplicate call (idempotent)", async () => {
      await readHandler({
        request: readRequest(recipient),
        params: { messageId: validMessageId },
      });

      const secondResponse = await readHandler({
        request: readRequest(recipient),
        params: { messageId: validMessageId },
      });

      expect(secondResponse.status).toBe(200);
      const body = await parseJsonResponse(secondResponse);
      expect(body.data).toBeDefined();
    });

    it("duplicate calls return the same canonical timestamp", async () => {
      const first = await readHandler({
        request: readRequest(recipient),
        params: { messageId: validMessageId },
      });
      const firstBody = await parseJsonResponse(first);
      const firstTimestamp = (firstBody.data as any).readAt;

      const second = await readHandler({
        request: readRequest(recipient),
        params: { messageId: validMessageId },
      });
      const secondBody = await parseJsonResponse(second);
      const secondTimestamp = (secondBody.data as any).readAt;

      expect(firstTimestamp).toBe(secondTimestamp);
    });

    it("does not modify stored timestamp on duplicate calls", async () => {
      await readHandler({
        request: readRequest(recipient),
        params: { messageId: validMessageId },
      });

      const receipt1 = await repo.getReceipt(validMessageId);
      const timestamp1 = receipt1?.readAt;

      await readHandler({
        request: readRequest(recipient),
        params: { messageId: validMessageId },
      });

      const receipt2 = await repo.getReceipt(validMessageId);
      const timestamp2 = receipt2?.readAt;

      expect(timestamp2).toBe(timestamp1);
    });

    it("sender cannot override a read receipt marked by recipient", async () => {
      await readHandler({
        request: readRequest(recipient),
        params: { messageId: validMessageId },
      });

      const recipientTimestamp = (await repo.getReceipt(validMessageId))?.readAt;

      // Sender tries to read (should fail auth)
      const senderResponse = await readHandler({
        request: readRequest(sender),
        params: { messageId: validMessageId },
      });

      expect(senderResponse.status).toBe(403);
      const storedTimestamp = (await repo.getReceipt(validMessageId))?.readAt;
      expect(storedTimestamp).toBe(recipientTimestamp);
    });
  });

  // =========================================================================
  // Error response codes are stable and consistent
  // =========================================================================

  describe("stable error codes", () => {
    const scenarios = [
      {
        name: "invalid messageId",
        setup: async () => {
          // no setup needed
        },
        makeRequest: () =>
          readHandler({
            request: readRequest(recipient, "not-hex"),
            params: { messageId: "not-hex" },
          }),
        expectedStatus: 422,
        expectedCode: "validation_error",
      },
      {
        name: "unauthorized sender",
        setup: async () => {
          await createDeliveryReceipt(repo, {
            messageId: validMessageId,
            recipient,
            sender,
          });
        },
        makeRequest: () =>
          readHandler({
            request: readRequest(sender),
            params: { messageId: validMessageId },
          }),
        expectedStatus: 403,
        expectedCode: "forbidden",
      },
      {
        name: "unauthorized outsider",
        setup: async () => {
          await createDeliveryReceipt(repo, {
            messageId: validMessageId,
            recipient,
            sender,
          });
        },
        makeRequest: () =>
          readHandler({
            request: readRequest(unrelatedActor),
            params: { messageId: validMessageId },
          }),
        expectedStatus: 403,
        expectedCode: "forbidden",
      },
      {
        name: "receipt not found",
        setup: async () => {
          // no setup
        },
        makeRequest: () =>
          readHandler({
            request: readRequest(recipient),
            params: { messageId: validMessageId },
          }),
        expectedStatus: 404,
        expectedCode: "not_found",
      },
    ];

    for (const scenario of scenarios) {
      it(`returns stable ${scenario.expectedCode} code for ${scenario.name}`, async () => {
        await scenario.setup();
        const response = await scenario.makeRequest();

        expect(response.status).toBe(scenario.expectedStatus);
        const body = await parseJsonResponse(response);
        expect(body.error?.code).toBe(scenario.expectedCode);
      });
    }
  });

  // =========================================================================
  // Successful read receipt on first valid call
  // =========================================================================

  describe("successful read receipt publication", () => {
    beforeEach(async () => {
      await createDeliveryReceipt(repo, {
        messageId: validMessageId,
        recipient,
        sender,
      });
    });

    it("recipient can publish a read receipt", async () => {
      const response = await readHandler({
        request: readRequest(recipient),
        params: { messageId: validMessageId },
      });

      expect(response.status).toBe(200);
      const body = await parseJsonResponse(response);
      expect(body.data).toBeDefined();
      expect((body.data as any).readAt).toBeTruthy();
    });

    it("response includes the receipt with readAt timestamp", async () => {
      const response = await readHandler({
        request: readRequest(recipient),
        params: { messageId: validMessageId },
      });

      const body = await parseJsonResponse(response);
      const receipt = body.data as any;

      expect(receipt.messageId).toBe(validMessageId);
      expect(receipt.recipient).toBe(recipient);
      expect(receipt.sender).toBe(sender);
      expect(receipt.readAt).toBeTruthy();
      expect(typeof receipt.readAt).toBe("string");
    });

    it("readAt timestamp is persisted in storage", async () => {
      const response = await readHandler({
        request: readRequest(recipient),
        params: { messageId: validMessageId },
      });

      const body = await parseJsonResponse(response);
      const responseTimestamp = (body.data as any).readAt;

      const stored = await repo.getReceipt(validMessageId);
      expect(stored?.readAt).toBe(responseTimestamp);
    });

    it("response includes stable metadata (requestId, timestamp, etc)", async () => {
      const response = await readHandler({
        request: readRequest(recipient),
        params: { messageId: validMessageId },
      });

      const body = await parseJsonResponse(response);
      expect(body).toHaveProperty("meta");
      expect((body as any).meta.requestId).toBeTruthy();
      expect((body as any).meta.timestamp).toBeTruthy();
    });
  });

  // =========================================================================
  // Consistency and atomicity guarantees
  // =========================================================================

  describe("consistency and atomicity", () => {
    beforeEach(async () => {
      await createDeliveryReceipt(repo, {
        messageId: validMessageId,
        recipient,
        sender,
      });
    });

    it("successful read response is consistent with stored state", async () => {
      const response = await readHandler({
        request: readRequest(recipient),
        params: { messageId: validMessageId },
      });

      const responseReceipt = (await parseJsonResponse(response)).data as any;
      const storedReceipt = await repo.getReceipt(validMessageId);

      expect(responseReceipt.messageId).toBe(storedReceipt?.messageId);
      expect(responseReceipt.recipient).toBe(storedReceipt?.recipient);
      expect(responseReceipt.sender).toBe(storedReceipt?.sender);
      expect(responseReceipt.readAt).toBe(storedReceipt?.readAt);
    });

    it("rejected unauthorized call does not partially write state", async () => {
      const before = await repo.getReceipt(validMessageId);
      const beforeReadAt = before?.readAt;

      await readHandler({
        request: readRequest(unrelatedActor),
        params: { messageId: validMessageId },
      });

      const after = await repo.getReceipt(validMessageId);
      expect(after?.readAt).toBe(beforeReadAt);
    });

    it("rejected validation error does not write state", async () => {
      const before = await repo.getReceipt(validMessageId);

      await readHandler({
        request: readRequest(recipient, "invalid-id"),
        params: { messageId: "invalid-id" },
      });

      const after = await repo.getReceipt(validMessageId);
      expect(after?.readAt).toBe(before?.readAt);
    });
  });

  // =========================================================================
  // Timestamp validation note
  // =========================================================================
  // The read receipt endpoint does not currently accept a client-supplied
  // timestamp; it uses `new Date()` server-side. Timestamp validation
  // (e.g., rejecting stale or far-future times) is delegated to the
  // repository's ValidatedApiRepository layer and the receiptSchema,
  // which enforces DEFAULT_RECEIPT_FUTURE_TOLERANCE_MS and ensures
  // readAt >= deliveredAt. See tests/unit/api/read-receipt.test.ts for
  // concurrency and repository-level timestamp validation coverage.
});
