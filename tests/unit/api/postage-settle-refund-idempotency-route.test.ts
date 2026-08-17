import { beforeEach, describe, expect, it } from "vitest";

import { Route as SettleRoute } from "../../../src/routes/api/v1/postage/$messageId/settle";
import { Route as RefundRoute } from "../../../src/routes/api/v1/postage/$messageId/refund";
import { ACTOR_HEADER } from "../../../src/server/api/actor";
import { getApiContext } from "../../../src/server/api/context";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";

const recipient = `G${"A".repeat(55)}`;
const sender = `G${"B".repeat(55)}`;

const settleHandler = (SettleRoute.options as any).server?.handlers?.POST;
const refundHandler = (RefundRoute.options as any).server?.handlers?.POST;

function request(messageId: string, idempotencyKey?: string) {
  const headers: Record<string, string> = { [ACTOR_HEADER]: recipient };
  if (idempotencyKey) headers["x-idempotency-key"] = idempotencyKey;
  return new Request(`https://stealth.test/api/v1/postage/${messageId}/settle`, {
    method: "POST",
    headers,
  });
}

async function parseJson(response: Response) {
  return response.clone().json() as Promise<{
    error?: { code: string; message: string };
    data?: any;
  }>;
}

describe("postage settle/refund idempotency (route-level, issue #1498)", () => {
  let repo: MemoryApiRepository;

  beforeEach(async () => {
    repo = (await getApiContext()).repository as MemoryApiRepository;
    repo.reset();
  });

  async function seedPostage(messageId: string, amount = "100") {
    await repo.setPostage({
      amount,
      createdAt: "2026-06-14T12:00:00.000Z",
      messageId,
      paymentHash: "b".repeat(64),
      recipient,
      sender,
      status: "pending",
    });
  }

  describe("settle", () => {
    it("replays the stored response for a duplicate identical request", async () => {
      const messageId = "a".repeat(64);
      await seedPostage(messageId);

      const first = await settleHandler({
        request: request(messageId, "settle-key-1"),
        params: { messageId },
      });
      expect(first.status).toBe(200);
      expect(first.headers.get("x-idempotency-replayed")).toBeNull();
      const firstBody = await parseJson(first);
      expect(firstBody.data.status).toBe("settled");

      const second = await settleHandler({
        request: request(messageId, "settle-key-1"),
        params: { messageId },
      });
      expect(second.status).toBe(200);
      expect(second.headers.get("x-idempotency-replayed")).toBe("true");
      const secondBody = await parseJson(second);
      expect(secondBody.data).toEqual(firstBody.data);

      // Only ever settled once.
      const finalPostage = await repo.getPostage(messageId);
      expect(finalPostage?.status).toBe("settled");
    });

    it("returns 409 idempotency_mismatch when the key is reused for a different message", async () => {
      const messageId1 = "a".repeat(64);
      const messageId2 = "c".repeat(64);
      await seedPostage(messageId1);
      await seedPostage(messageId2);

      const first = await settleHandler({
        request: request(messageId1, "shared-settle-key"),
        params: { messageId: messageId1 },
      });
      expect(first.status).toBe(200);

      const second = await settleHandler({
        request: request(messageId2, "shared-settle-key"),
        params: { messageId: messageId2 },
      });
      expect(second.status).toBe(409);
      const body = await parseJson(second);
      expect(body.error?.code).toBe("idempotency_mismatch");

      // The second message must remain untouched by the rejected request.
      const postage2 = await repo.getPostage(messageId2);
      expect(postage2?.status).toBe("pending");
    });

    it("executes the operation exactly once under concurrent identical duplicates", async () => {
      const messageId = "a".repeat(64);
      await seedPostage(messageId);

      const responses = await Promise.all(
        Array.from({ length: 5 }, () =>
          settleHandler({
            request: request(messageId, "concurrent-settle-key"),
            params: { messageId },
          }),
        ),
      );

      const statuses = responses.map((response: Response) => response.status).sort();
      // Exactly one winner (200); every other concurrent duplicate is
      // rejected as in-progress (409) rather than re-running the settlement.
      expect(statuses.filter((status: number) => status === 200)).toHaveLength(1);
      expect(statuses.filter((status: number) => status === 409)).toHaveLength(4);

      const finalPostage = await repo.getPostage(messageId);
      expect(finalPostage?.status).toBe("settled");
    });
  });

  describe("refund", () => {
    function refundRequest(messageId: string, idempotencyKey?: string) {
      const headers: Record<string, string> = { [ACTOR_HEADER]: recipient };
      if (idempotencyKey) headers["x-idempotency-key"] = idempotencyKey;
      return new Request(`https://stealth.test/api/v1/postage/${messageId}/refund`, {
        method: "POST",
        headers,
      });
    }

    it("replays the stored response for a duplicate identical request", async () => {
      const messageId = "a".repeat(64);
      await seedPostage(messageId);

      const first = await refundHandler({
        request: refundRequest(messageId, "refund-key-1"),
        params: { messageId },
      });
      expect(first.status).toBe(200);

      const second = await refundHandler({
        request: refundRequest(messageId, "refund-key-1"),
        params: { messageId },
      });
      expect(second.status).toBe(200);
      expect(second.headers.get("x-idempotency-replayed")).toBe("true");

      const finalPostage = await repo.getPostage(messageId);
      expect(finalPostage?.status).toBe("refunded");
    });

    it("returns 409 idempotency_mismatch when the key is reused for a different message", async () => {
      const messageId1 = "a".repeat(64);
      const messageId2 = "c".repeat(64);
      await seedPostage(messageId1);
      await seedPostage(messageId2);

      await refundHandler({
        request: refundRequest(messageId1, "shared-refund-key"),
        params: { messageId: messageId1 },
      });

      const second = await refundHandler({
        request: refundRequest(messageId2, "shared-refund-key"),
        params: { messageId: messageId2 },
      });
      expect(second.status).toBe(409);
      const body = await parseJson(second);
      expect(body.error?.code).toBe("idempotency_mismatch");
    });
  });
});
