import { createIdentity, expect, test } from "./fixtures";

test.describe("postage API", () => {
  test("quotes zero postage for an explicitly allowed sender", async ({ api }) => {
    const actor = createIdentity();
    const sender = createIdentity();

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
    const actor = createIdentity();
    const sender = createIdentity();

    await api.setSenderRule(actor, sender, "block");
    const res = await api.quotePostage(actor, sender);
    expect(res.status()).toBe(200);

    const { data } = await res.json();
    expect(data.eligible).toBe(false);
    expect(data.reason).toBe("sender_blocked");
  });

  test("submits postage and then settles it", async ({ api }) => {
    const actor = createIdentity();
    const sender = createIdentity();
    const msgId = "3".repeat(64);

    await api.putPolicy(actor, {
      allowUnknown: true,
      minimumPostage: "100",
      requireVerified: false,
    });

    const quoteRes = await api.quotePostage(actor, sender);
    const { data: quoteData } = await quoteRes.json();

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
        issuedAt: quoteData.issuedAt,
        expiresAt: quoteData.expiresAt,
        quoteDigest: quoteData.digest,
      },
    });
    expect(submitRes.status()).toBe(201);
    expect((await submitRes.json()).data.status).toBe("pending");

    const settleRes = await api.settlePostage(msgId, actor);
    expect(settleRes.status()).toBe(200);
    expect((await settleRes.json()).data.status).toBe("settled");
  });

  test("submits postage and then refunds it", async ({ api }) => {
    const actor = createIdentity();
    const sender = createIdentity();
    const msgId = "c".repeat(64);
    const payHash = "d".repeat(64);

    await api.putPolicy(actor, {
      allowUnknown: true,
      minimumPostage: "50",
      requireVerified: false,
    });

    const quoteRes = await api.quotePostage(actor, sender);
    const { data: quoteData } = await quoteRes.json();

    const submitRes = await page.request.post("/api/v1/postage/", {
      headers: { "Content-Type": "application/json", "x-stealth-address": sender },
      data: {
        amount: "50",
        messageId: msgId,
        paymentHash: payHash,
        recipient: actor,
        sender: sender,
        issuedAt: quoteData.issuedAt,
        expiresAt: quoteData.expiresAt,
        quoteDigest: quoteData.digest,
      },
    });
    expect(submitRes.status()).toBe(201);

    await api.putPolicy(actor);
    expect((await api.submitPostage(msgId, "d".repeat(64), "50", actor, sender)).status()).toBe(
      201,
    );

    const refundRes = await api.refundPostage(msgId, actor);
    expect(refundRes.status()).toBe(200);
    expect((await refundRes.json()).data.status).toBe("refunded");
  });

  test("rejects duplicate postage submission with 409", async ({ api }) => {
    const actor = createIdentity();
    const sender = createIdentity();
    const msgId = "e".repeat(64);
    const payHash = "f".repeat(64);

    await api.putPolicy(actor, { allowUnknown: true, minimumPostage: "0", requireVerified: false });

    const quoteRes = await api.quotePostage(actor, sender);
    const { data: quoteData } = await quoteRes.json();

    const submitFn = () =>
      page.request.post("/api/v1/postage/", {
        headers: { "Content-Type": "application/json", "x-stealth-address": sender },
        data: {
          amount: "0",
          messageId: msgId,
          paymentHash: payHash,
          recipient: actor,
          sender: sender,
          issuedAt: quoteData.issuedAt,
          expiresAt: quoteData.expiresAt,
          quoteDigest: quoteData.digest,
        },
      });

    const first = await submitFn();
    expect(first.status()).toBe(201);

    const second = await submitFn();
    expect(second.status()).toBe(409);
  });

  test("rejects postage below mailbox minimum with 422", async ({ api }) => {
    const actor = createIdentity();
    const sender = createIdentity();

    await api.putPolicy(actor, {
      allowUnknown: true,
      minimumPostage: "1000",
      requireVerified: false,
    });

    const quoteRes = await api.quotePostage(actor, sender);
    const { data: quoteData } = await quoteRes.json();

    const res = await page.request.post("/api/v1/postage/", {
      headers: { "Content-Type": "application/json", "x-stealth-address": sender },
      data: {
        amount: "1",
        messageId: msgId,
        paymentHash: payHash,
        recipient: actor,
        sender: sender,
        issuedAt: quoteData.issuedAt,
        expiresAt: quoteData.expiresAt,
        quoteDigest: quoteData.digest,
      },
    });
    expect(res.status()).toBe(422);
  });
});
