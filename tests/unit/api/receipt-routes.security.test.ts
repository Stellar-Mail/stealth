import { beforeEach, describe, expect, it } from "vitest";

import { Keypair } from "@stellar/stellar-sdk";
import { Route as DeliveryRoute } from "../../../src/routes/api/v1/receipts/index";
import { Route as ReadRoute } from "../../../src/routes/api/v1/receipts/$messageId/read";
import { createSignedRequest } from "./signed-request";
import { getApiContext } from "../../../src/server/api/context";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import { createDeliveryReceipt } from "../../../src/server/api/receipt-service";

const senderKeypair = Keypair.random();
const recipientKeypair = Keypair.random();
const unrelatedKeypair = Keypair.random();

const sender = senderKeypair.publicKey();
const recipient = recipientKeypair.publicKey();
const unrelatedActor = unrelatedKeypair.publicKey();
const messageId = "d".repeat(64);

const deliveryHandler = (DeliveryRoute.options as any).server?.handlers?.POST;
const readHandler = (ReadRoute.options as any).server?.handlers?.POST;

async function deliveryRequest(actorKey: Keypair) {
  return createSignedRequest(actorKey, "https://stealth.test/api/v1/receipts", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ messageId, recipient, sender }),
  });
}

async function readRequest(actorKey: Keypair) {
  return createSignedRequest(actorKey, `https://stealth.test/api/v1/receipts/${messageId}/read`, {
    method: "POST",
  });
}

describe("receipt route publication roles", () => {
  let repo: MemoryApiRepository;

  beforeEach(async () => {
    repo = (await getApiContext()).repository as MemoryApiRepository;
    repo.reset();
  });

  it("allows only the sender to publish a delivery receipt", async () => {
    const response = await deliveryHandler({ request: await deliveryRequest(senderKeypair) });

    expect(response.status).toBe(201);
    await expect(repo.getReceipt(messageId)).resolves.toMatchObject({
      messageId,
      readAt: null,
      recipient,
      sender,
    });
  });

  it.each([
    ["recipient", recipientKeypair],
    ["unrelated actor", unrelatedKeypair],
  ])("rejects the %s as a delivery publisher without mutating state", async (_role, actorKey) => {
    const response = await deliveryHandler({ request: await deliveryRequest(actorKey) });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "forbidden" } });
    await expect(repo.getReceipt(messageId)).resolves.toBeNull();
  });

  it("allows only the recipient to publish a read receipt", async () => {
    await createDeliveryReceipt(repo, { messageId, recipient, sender });

    const response = await readHandler({
      request: await readRequest(recipientKeypair),
      params: { messageId },
    });

    expect(response.status).toBe(200);
    await expect(repo.getReceipt(messageId)).resolves.toMatchObject({
      readAt: expect.any(String),
    });
  });

  it.each([
    ["sender", senderKeypair],
    ["unrelated actor", unrelatedKeypair],
  ])("rejects the %s as a read publisher without mutating state", async (_role, actorKey) => {
    await createDeliveryReceipt(repo, { messageId, recipient, sender });

    const response = await readHandler({
      request: await readRequest(actorKey),
      params: { messageId },
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "forbidden" } });
    await expect(repo.getReceipt(messageId)).resolves.toMatchObject({ readAt: null });
  });
});
