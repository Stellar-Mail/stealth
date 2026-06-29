import { test, expect, ACTOR, SENDER } from "./fixtures";

// API-level tests for the receipt lifecycle.  The dev server must be running
// so that TanStack Start API routes are reachable at /api/v1/…

test.describe("receipts API", () => {
  test("creates a delivery receipt and returns it", async ({ api }) => {
    const msgId = "f".repeat(64);
    const recipient = `${ACTOR.slice(0, -2)}CA`;
    const sender = `${SENDER.slice(0, -2)}CA`;

    const createRes = await api.createReceipt(msgId, recipient, sender);
    expect(createRes.status()).toBe(201);

    const { data: created } = await createRes.json();
    expect(created).toMatchObject({
      messageId: msgId,
      recipient,
      sender,
      deliveredAt: expect.any(String),
      readAt: null,
    });
  });

  test("retrieves an existing receipt by message id", async ({ api }) => {
    const msgId = "e".repeat(64);
    const recipient = `${ACTOR.slice(0, -2)}CB`;
    const sender = `${SENDER.slice(0, -2)}CB`;

    const createRes = await api.createReceipt(msgId, recipient, sender);
    expect(createRes.status()).toBe(201);

    const getRes = await api.getReceipt(msgId, recipient);
    expect(getRes.status()).toBe(200);

    const { data } = await getRes.json();
    expect(data).toMatchObject({
      messageId: msgId,
      recipient,
      sender,
      deliveredAt: expect.any(String),
    });
  });

  test("marks a receipt as read once", async ({ api }) => {
    const msgId = "a".repeat(64);
    const recipient = `${ACTOR.slice(0, -2)}CC`;
    const sender = `${SENDER.slice(0, -2)}CC`;

    // Sender creates the receipt
    await api.createReceipt(msgId, recipient, sender);

    // Recipient marks it as read
    const readRes = await api.markReceiptRead(msgId, recipient);
    expect(readRes.status()).toBe(200);

    const { data: read } = await readRes.json();
    expect(read).toMatchObject({
      messageId: msgId,
      readAt: expect.any(String),
    });

    // Duplicate read mark is rejected
    const dupRes = await api.markReceiptRead(msgId, recipient);
    expect(dupRes.status()).toBe(409);
  });

  test("rejects duplicate delivery receipt with 409", async ({ api }) => {
    const msgId = "d".repeat(64);
    const recipient = `${ACTOR.slice(0, -2)}CD`;
    const sender = `${SENDER.slice(0, -2)}CD`;

    const first = await api.createReceipt(msgId, recipient, sender);
    expect(first.status()).toBe(201);

    const second = await api.createReceipt(msgId, recipient, sender);
    expect(second.status()).toBe(409);
  });

  test("rejects non-sender trying to create a delivery receipt with 403", async ({ page }) => {
    const msgId = "c".repeat(64);
    const recipient = `${ACTOR.slice(0, -2)}CE`;
    const sender = `${SENDER.slice(0, -2)}CE`;
    const impersonator = `${ACTOR.slice(0, -2)}XX`;

    // impersonator sends a request with their own address in the header
    // but claims to be a different sender in the body
    const res = await page.request.post("/api/v1/receipts/", {
      headers: {
        "Content-Type": "application/json",
        "x-stealth-address": impersonator,
      },
      data: { messageId: msgId, recipient, sender },
    });
    expect(res.status()).toBe(403);
  });

  test("rejects non-recipient trying to mark as read with 403", async ({ api }) => {
    const msgId = "b".repeat(64);
    const recipient = `${ACTOR.slice(0, -2)}CF`;
    const sender = `${SENDER.slice(0, -2)}CF`;
    const thirdParty = `${ACTOR.slice(0, -2)}YY`;

    await api.createReceipt(msgId, recipient, sender);

    // A third party (not the recipient) tries to mark as read
    const res = await api.markReceiptRead(msgId, thirdParty);
    expect(res.status()).toBe(403);
  });

  test("returns 404 for a non-existent receipt", async ({ api }) => {
    const res = await api.getReceipt("9".repeat(64), ACTOR);
    expect(res.status()).toBe(404);
  });

  test("returns 401 when actor header is missing", async ({ page }) => {
    const res = await page.request.post("/api/v1/receipts/", {
      headers: { "Content-Type": "application/json" },
      data: {
        messageId: "0".repeat(64),
        recipient: `${ACTOR.slice(0, -2)}ZZ`,
        sender: `${SENDER.slice(0, -2)}ZZ`,
      },
    });
    expect(res.status()).toBe(401);
  });
});
