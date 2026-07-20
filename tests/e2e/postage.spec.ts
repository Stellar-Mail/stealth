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
    const submitRes = await api.submitPostage(msgId, msgId, "100", actor, sender);
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
    const submit = () => api.submitPostage(msgId, "f".repeat(64), "0", actor, sender);

    await api.putPolicy(actor);
    expect((await submit()).status()).toBe(201);
    expect((await submit()).status()).toBe(409);
  });

  test("rejects postage below mailbox minimum with 422", async ({ api }) => {
    const actor = createIdentity();
    const sender = createIdentity();

    await api.putPolicy(actor, {
      allowUnknown: true,
      minimumPostage: "1000",
      requireVerified: false,
    });
    const res = await api.submitPostage("9".repeat(64), "8".repeat(64), "1", actor, sender);
    expect(res.status()).toBe(422);
  });
});
