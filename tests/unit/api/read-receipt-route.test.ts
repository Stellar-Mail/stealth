import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { Route } from "../../../src/routes/api/v1/receipts/$messageId/read";
import { getApiContext } from "../../../src/server/api/context";
import { createDeliveryReceipt } from "../../../src/server/api/receipt-service";

const messageId = "a".repeat(64);
const recipient = `G${"A".repeat(55)}`;
const sender = `G${"B".repeat(55)}`;

describe("POST /api/v1/receipts/:messageId/read", () => {
  beforeEach(() => {
    getApiContext().repository.reset?.();
  });

  const createRequest = (body: unknown, actor: string = recipient) => {
    return new Request(`https://stealth.test/api/v1/receipts/${messageId}/read`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-stealth-address": actor,
      },
      body: JSON.stringify(body),
    });
  };

  it("marks a receipt as read when requested by the recipient", async () => {
    const repository = getApiContext().repository;
    await createDeliveryReceipt(repository, { messageId, recipient, sender }, new Date("2026-07-17T12:00:00Z"));

    const request = createRequest({ readAt: "2026-07-17T12:05:00Z" });
    const response = await Route.options.server.handlers.POST({ request, params: { messageId } });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toMatchObject({
      messageId,
      recipient,
      sender,
      readAt: "2026-07-17T12:05:00.000Z",
    });

    const stored = await repository.getReceipt(messageId);
    expect(stored?.readAt).toBe("2026-07-17T12:05:00.000Z");
  });

  it("rejects unauthorized actors", async () => {
    const repository = getApiContext().repository;
    await createDeliveryReceipt(repository, { messageId, recipient, sender }, new Date("2026-07-17T12:00:00Z"));

    const request = createRequest({ readAt: "2026-07-17T12:05:00Z" }, sender); // unauthorized, sender can't mark read
    const response = await Route.options.server.handlers.POST({ request, params: { messageId } });

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe("forbidden");
  });

  it("rejects invalid payloads", async () => {
    const repository = getApiContext().repository;
    await createDeliveryReceipt(repository, { messageId, recipient, sender }, new Date("2026-07-17T12:00:00Z"));

    const request = createRequest({ readAt: "not-a-date" });
    const response = await Route.options.server.handlers.POST({ request, params: { messageId } });

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("validation_error");
  });

  it("rejects duplicate read receipts deterministically", async () => {
    const repository = getApiContext().repository;
    await createDeliveryReceipt(repository, { messageId, recipient, sender }, new Date("2026-07-17T12:00:00Z"));

    const request1 = createRequest({ readAt: "2026-07-17T12:05:00Z" });
    await Route.options.server.handlers.POST({ request: request1, params: { messageId } });

    const request2 = createRequest({ readAt: "2026-07-17T12:06:00Z" });
    const response2 = await Route.options.server.handlers.POST({ request: request2, params: { messageId } });

    expect(response2.status).toBe(409);
    const body = await response2.json();
    expect(body.error.code).toBe("conflict");
  });

  it("rejects stale timestamps (before delivery)", async () => {
    const repository = getApiContext().repository;
    await createDeliveryReceipt(repository, { messageId, recipient, sender }, new Date("2026-07-17T12:00:00Z"));

    const request = createRequest({ readAt: "2026-07-17T11:00:00Z" }); // before delivery
    const response = await Route.options.server.handlers.POST({ request, params: { messageId } });

    expect(response.status).toBe(400); // 400 Bad Request
    const body = await response.json();
    expect(body.error.code).toBe("bad_request");
  });
});
