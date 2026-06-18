import { test, expect, ACTOR, SENDER } from "./fixtures";

// API-level tests – no UI navigation required. The dev server must be running
// so that the TanStack Start API routes are reachable at /api/v1/…

test.describe("postage API", () => {
  test("quotes zero postage for an explicitly allowed sender", async ({ api }) => {
    const actor = `${ACTOR.slice(0, -2)}A2`;
    const sender = `${SENDER.slice(0, -2)}A2`;

    // Allow the sender first
    await api.putPolicy(actor, {
      allowUnknown: true,
      minimumPostage: "100",
      requireVerified: false,
    });
    await api.setSenderRule(actor, sender, "allow");

    const res = await api.quotePostage(actor, sender);
    expect(res.status()).toBe(200);

    const { data } = await res.json();
    expect(data.amount).toBe("0");
    expect(data.trusted).toBe(true);
    expect(data.eligible).toBe(true);
  });

  test("quote marks blocked sender as ineligible", async ({ api }) => {
    const actor = `${ACTOR.slice(0, -2)}A3`;
    const sender = `${SENDER.slice(0, -2)}A3`;

    await api.setSenderRule(actor, sender, "block");

    const res = await api.quotePostage(actor, sender);
    expect(res.status()).toBe(200);

    const { data } = await res.json();
    expect(data.eligible).toBe(false);
    expect(data.reason).toBe("sender_blocked");
  });

  test("submits postage and then settles it", async ({ page, api }) => {
    const actor = `${ACTOR.slice(0, -2)}A4`;
    const sender = `${SENDER.slice(0, -2)}A4`;
    const msgId = "3".repeat(64);
    const payHash = "3".repeat(64);

    await api.putPolicy(actor, {
      allowUnknown: true,
      minimumPostage: "100",
      requireVerified: false,
    });

    const submitRes = await page.request.post("/api/v1/postage/", {
      headers: {
        "Content-Type": "application/json",
        "x-stealth-address": sender,
      },
      data: {
        amount: "100",
        messageId: msgId,
        paymentHash: payHash,
        recipient: actor,
        sender: sender,
      },
    });
    expect(submitRes.status()).toBe(201);
    const { data: pending } = await submitRes.json();
    expect(pending.status).toBe("pending");

    // Settle as recipient (actor)
    const settleRes = await page.request.post(`/api/v1/postage/${msgId}/settle`, {
      headers: {
        "Content-Type": "application/json",
        "x-stealth-address": actor,
      },
    });
    expect(settleRes.status()).toBe(200);
    const { data: settled } = await settleRes.json();
    expect(settled.status).toBe("settled");
  });

  test("submits postage and then refunds it", async ({ page, api }) => {
    const actor = `${ACTOR.slice(0, -2)}A5`;
    const sender = `${SENDER.slice(0, -2)}A5`;
    const msgId = "c".repeat(64);
    const payHash = "d".repeat(64);

    await api.putPolicy(actor, { allowUnknown: true, minimumPostage: "0", requireVerified: false });

    const submitRes = await page.request.post("/api/v1/postage/", {
      headers: { "Content-Type": "application/json", "x-stealth-address": sender },
      data: {
        amount: "50",
        messageId: msgId,
        paymentHash: payHash,
        recipient: actor,
        sender: sender,
      },
    });
    expect(submitRes.status()).toBe(201);

    const refundRes = await page.request.post(`/api/v1/postage/${msgId}/refund`, {
      headers: { "Content-Type": "application/json", "x-stealth-address": actor },
    });
    expect(refundRes.status()).toBe(200);
    const { data } = await refundRes.json();
    expect(data.status).toBe("refunded");
  });

  test("rejects duplicate postage submission with 409", async ({ page, api }) => {
    const actor = `${ACTOR.slice(0, -2)}A6`;
    const sender = `${SENDER.slice(0, -2)}A6`;
    const msgId = "e".repeat(64);
    const payHash = "f".repeat(64);

    await api.putPolicy(actor, { allowUnknown: true, minimumPostage: "0", requireVerified: false });

    const submitFn = () =>
      page.request.post("/api/v1/postage/", {
        headers: { "Content-Type": "application/json", "x-stealth-address": sender },
        data: {
          amount: "0",
          messageId: msgId,
          paymentHash: payHash,
          recipient: actor,
          sender: sender,
        },
      });

    const first = await submitFn();
    expect(first.status()).toBe(201);

    const second = await submitFn();
    expect(second.status()).toBe(409);
  });

  test("rejects postage below mailbox minimum with 422", async ({ page, api }) => {
    const actor = `${ACTOR.slice(0, -2)}A7`;
    const sender = `${SENDER.slice(0, -2)}A7`;
    const msgId = "9".repeat(64);
    const payHash = "8".repeat(64);

    await api.putPolicy(actor, {
      allowUnknown: true,
      minimumPostage: "1000",
      requireVerified: false,
    });

    const res = await page.request.post("/api/v1/postage/", {
      headers: { "Content-Type": "application/json", "x-stealth-address": sender },
      data: {
        amount: "1",
        messageId: msgId,
        paymentHash: payHash,
        recipient: actor,
        sender: sender,
      },
    });
    expect(res.status()).toBe(422);
  });
});
