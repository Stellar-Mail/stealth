import { ACTOR_IDENTITY, createIdentity, expect, test } from "./fixtures";

test.describe("receipts API", () => {
  test("creates a delivery receipt and returns it", async ({ api }) => {
    const recipient = createIdentity();
    const sender = createIdentity();
    const msgId = "f".repeat(64);
    const createRes = await api.createReceipt(msgId, recipient, sender);

    expect(createRes.status()).toBe(201);
    expect((await createRes.json()).data).toMatchObject({
      messageId: msgId,
      recipient: recipient.address,
      sender: sender.address,
      deliveredAt: expect.any(String),
      readAt: null,
    });
  });

  test("retrieves an existing receipt by message id", async ({ api }) => {
    const recipient = createIdentity();
    const sender = createIdentity();
    const msgId = "e".repeat(64);

    expect((await api.createReceipt(msgId, recipient, sender)).status()).toBe(201);
    const getRes = await api.getReceipt(msgId, recipient);
    expect(getRes.status()).toBe(200);
    expect((await getRes.json()).data).toMatchObject({
      messageId: msgId,
      recipient: recipient.address,
      sender: sender.address,
      deliveredAt: expect.any(String),
    });
  });

  test("marks a receipt as read idempotently", async ({ api }) => {
    const msgId = "a".repeat(64);

    await api.createReceipt(msgId, recipient, sender);
    const readRes = await api.markReceiptRead(msgId, recipient);
    expect(readRes.status()).toBe(200);
    expect((await readRes.json()).data).toMatchObject({
      messageId: msgId,
      readAt: expect.any(String),
    });

    // Duplicate read mark replays the original read timestamp
    const dupRes = await api.markReceiptRead(msgId, recipient);
    expect(dupRes.status()).toBe(200);
    const { data: duplicateRead } = await dupRes.json();
    expect(duplicateRead).toEqual(read);
  });

  test("replays duplicate delivery receipt", async ({ api }) => {
    const msgId = "d".repeat(64);

    const first = await api.createReceipt(msgId, recipient, sender);
    expect(first.status()).toBe(201);
    const { data: firstReceipt } = await first.json();

    const second = await api.createReceipt(msgId, recipient, sender);
    expect(second.status()).toBe(201);
    const { data: secondReceipt } = await second.json();
    expect(secondReceipt).toEqual(firstReceipt);
  });

  test("rejects non-sender trying to create a delivery receipt with 403", async ({ api }) => {
    const recipient = createIdentity();
    const sender = createIdentity();
    const impersonator = createIdentity();
    const res = await api.request("POST", "/api/v1/receipts/", impersonator, {
      messageId: "c".repeat(64),
      recipient: recipient.address,
      sender: sender.address,
    });
    expect(res.status()).toBe(403);
  });

  test("rejects non-recipient trying to mark as read with 403", async ({ api }) => {
    const recipient = createIdentity();
    const sender = createIdentity();
    const thirdParty = createIdentity();
    const msgId = "b".repeat(64);

    await api.createReceipt(msgId, recipient, sender);
    expect((await api.markReceiptRead(msgId, thirdParty)).status()).toBe(403);
  });

  test("returns 404 for a non-existent receipt", async ({ api }) => {
    expect((await api.getReceipt("9".repeat(64), ACTOR_IDENTITY)).status()).toBe(404);
  });

  test("returns 401 when actor headers are missing", async ({ page }) => {
    const recipient = createIdentity();
    const sender = createIdentity();
    const res = await page.request.post("/api/v1/receipts/", {
      headers: { "Content-Type": "application/json" },
      data: {
        messageId: "0".repeat(64),
        recipient: recipient.address,
        sender: sender.address,
      },
    });
    expect(res.status()).toBe(401);
  });
});
