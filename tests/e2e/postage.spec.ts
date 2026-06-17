import { test, expect } from "./fixtures";
import type { TestInfo } from "@playwright/test";

// API-level tests – no UI navigation required. The dev server must be running
// so that the TanStack Start API routes are reachable at /api/v1/…

test.describe("postage API", () => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

  function scenario(testInfo: TestInfo) {
    const seed = `${testInfo.title}-${Date.now()}-${Math.random()}`;
    return {
      actor: stellarAddress(`${seed}-actor`),
      sender: stellarAddress(`${seed}-sender`),
      messageId: hexHash(`${seed}-message`),
      paymentHash: hexHash(`${seed}-payment`),
    };
  }

  function stellarAddress(seed: string) {
    return `G${Array.from({ length: 55 }, (_, index) => {
      const code = seed.charCodeAt(index % seed.length) + index * 17;
      return alphabet[code % alphabet.length];
    }).join("")}`;
  }

  function hexHash(seed: string) {
    const hex = Array.from(seed)
      .map((char, index) => ((char.charCodeAt(0) + index * 13) % 16).toString(16))
      .join("");
    return hex.padEnd(64, "0").slice(0, 64);
  }

  test("quotes zero postage for an explicitly allowed sender", async ({ api }, testInfo) => {
    const { actor, sender } = scenario(testInfo);
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

  test("quote marks blocked sender as ineligible", async ({ api }, testInfo) => {
    const { actor, sender } = scenario(testInfo);
    await api.setSenderRule(actor, sender, "block");

    const res = await api.quotePostage(actor, sender);
    expect(res.status()).toBe(200);

    const { data } = await res.json();
    expect(data.eligible).toBe(false);
    expect(data.reason).toBe("sender_blocked");
  });

  test("submits postage and then settles it", async ({ page, api }, testInfo) => {
    const { actor, sender, messageId, paymentHash } = scenario(testInfo);
    await api.putPolicy(actor, {
      allowUnknown: true,
      minimumPostage: "100",
      requireVerified: false,
    });

    const submitRes = await api.submitPostage(messageId, paymentHash, "100", actor, sender);
    expect(submitRes.status()).toBe(201);
    const { data: pending } = await submitRes.json();
    expect(pending.status).toBe("pending");

    // Settle as recipient (ACTOR)
    const settleRes = await page.request.post(`/api/v1/postage/${messageId}/settle`, {
      headers: {
        "Content-Type": "application/json",
        "x-stealth-address": actor,
      },
    });
    expect(settleRes.status()).toBe(200);
    const { data: settled } = await settleRes.json();
    expect(settled.status).toBe("settled");
  });

  test("submits postage and then refunds it", async ({ page, api }, testInfo) => {
    const { actor, sender, messageId, paymentHash } = scenario(testInfo);

    await api.putPolicy(actor, { allowUnknown: true, minimumPostage: "0", requireVerified: false });

    const submitRes = await api.submitPostage(messageId, paymentHash, "50", actor, sender);
    expect(submitRes.status()).toBe(201);

    const refundRes = await page.request.post(`/api/v1/postage/${messageId}/refund`, {
      headers: { "Content-Type": "application/json", "x-stealth-address": actor },
    });
    expect(refundRes.status()).toBe(200);
    const { data } = await refundRes.json();
    expect(data.status).toBe("refunded");
  });

  test("rejects duplicate postage submission with 409", async ({ api }, testInfo) => {
    const { actor, sender, messageId, paymentHash } = scenario(testInfo);

    await api.putPolicy(actor, { allowUnknown: true, minimumPostage: "0", requireVerified: false });

    const first = await api.submitPostage(messageId, paymentHash, "0", actor, sender);
    expect(first.status()).toBe(201);

    const second = await api.submitPostage(messageId, paymentHash, "0", actor, sender);
    expect(second.status()).toBe(409);
  });

  test("rejects postage below mailbox minimum with 422", async ({ api }, testInfo) => {
    const { actor, sender, messageId, paymentHash } = scenario(testInfo);
    await api.putPolicy(actor, {
      allowUnknown: true,
      minimumPostage: "1000",
      requireVerified: false,
    });

    const res = await api.submitPostage(messageId, paymentHash, "1", actor, sender);
    expect(res.status()).toBe(422);
  });
});
