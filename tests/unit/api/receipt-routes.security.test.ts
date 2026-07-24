import { beforeEach, describe, expect, it } from "vitest";

import { Route as DeliveryRoute } from "../../../src/routes/api/v1/receipts/index";
import { Route as ReadRoute } from "../../../src/routes/api/v1/receipts/$messageId/read";
import { ACTOR_HEADER } from "../../../src/server/api/actor";
import { getApiContext } from "../../../src/server/api/context";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import { createDeliveryReceipt } from "../../../src/server/api/receipt-service";

const sender = `G${"A".repeat(55)}`;
const recipient = `G${"B".repeat(55)}`;
const unrelatedActor = `G${"C".repeat(55)}`;
const messageId = "d".repeat(64);

const deliveryHandler = (DeliveryRoute.options as any).server?.handlers?.POST;
const readHandler = (ReadRoute.options as any).server?.handlers?.POST;

function deliveryRequest(actor: string) {
  return new Request("https://stealth.test/api/v1/receipts", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [ACTOR_HEADER]: actor,
    },
    body: JSON.stringify({ messageId, recipient, sender }),
  });
}

function readRequest(actor: string) {
  return new Request(`https://stealth.test/api/v1/receipts/${messageId}/read`, {
    method: "POST",
    headers: { [ACTOR_HEADER]: actor },
  });
}

describe("receipt route publication roles", () => {
  let repo: MemoryApiRepository;

  beforeEach(async () => {
    repo = (await getApiContext()).repository as MemoryApiRepository;
    repo.reset();
  });

  it("allows only the sender to publish a delivery receipt", async () => {
    const response = await deliveryHandler({ request: deliveryRequest(sender) });

    expect(response.status).toBe(201);
    await expect(repo.getReceipt(messageId)).resolves.toMatchObject({
      messageId,
      readAt: null,
      recipient,
      sender,
    });
  });

  it.each([
    ["recipient", recipient],
    ["unrelated actor", unrelatedActor],
  ])("rejects the %s as a delivery publisher without mutating state", async (_role, actor) => {
    const response = await deliveryHandler({ request: deliveryRequest(actor) });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "forbidden" } });
    await expect(repo.getReceipt(messageId)).resolves.toBeNull();
  });

  it("allows only the recipient to publish a read receipt", async () => {
    await createDeliveryReceipt(repo, { messageId, recipient, sender });

    const response = await readHandler({
      request: readRequest(recipient),
      params: { messageId },
    });

    expect(response.status).toBe(200);
    await expect(repo.getReceipt(messageId)).resolves.toMatchObject({
      readAt: expect.any(String),
    });
  });

  it.each([
    ["sender", sender],
    ["unrelated actor", unrelatedActor],
  ])("rejects the %s as a read publisher without mutating state", async (_role, actor) => {
    await createDeliveryReceipt(repo, { messageId, recipient, sender });

    const response = await readHandler({
      request: readRequest(actor),
      params: { messageId },
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "forbidden" } });
    await expect(repo.getReceipt(messageId)).resolves.toMatchObject({ readAt: null });
  });
});
