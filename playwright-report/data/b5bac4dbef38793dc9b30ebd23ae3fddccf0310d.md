# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: postage.spec.ts >> postage API >> submits postage and then settles it
- Location: tests\e2e\postage.spec.ts:36:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 201
Received: 403
```

# Test source

```ts
  1   | import { test, expect, ACTOR, SENDER, MSG_ID, PAYMENT_HASH } from "./fixtures";
  2   | 
  3   | // API-level tests – no UI navigation required. The dev server must be running
  4   | // so that the TanStack Start API routes are reachable at /api/v1/…
  5   | 
  6   | test.describe("postage API", () => {
  7   |   test("quotes zero postage for an explicitly allowed sender", async ({ api }) => {
  8   |     // Allow the sender first
  9   |     await api.putPolicy(ACTOR, {
  10  |       allowUnknown: true,
  11  |       minimumPostage: "100",
  12  |       requireVerified: false,
  13  |     });
  14  |     await api.setSenderRule(ACTOR, SENDER, "allow");
  15  | 
  16  |     const res = await api.quotePostage(ACTOR, SENDER);
  17  |     expect(res.status()).toBe(200);
  18  | 
  19  |     const { data } = await res.json();
  20  |     expect(data.amount).toBe("0");
  21  |     expect(data.trusted).toBe(true);
  22  |     expect(data.eligible).toBe(true);
  23  |   });
  24  | 
  25  |   test("quote marks blocked sender as ineligible", async ({ api }) => {
  26  |     await api.setSenderRule(ACTOR, SENDER, "block");
  27  | 
  28  |     const res = await api.quotePostage(ACTOR, SENDER);
  29  |     expect(res.status()).toBe(200);
  30  | 
  31  |     const { data } = await res.json();
  32  |     expect(data.eligible).toBe(false);
  33  |     expect(data.reason).toBe("sender_blocked");
  34  |   });
  35  | 
  36  |   test("submits postage and then settles it", async ({ page, api }) => {
  37  |     await api.putPolicy(ACTOR, {
  38  |       allowUnknown: true,
  39  |       minimumPostage: "100",
  40  |       requireVerified: false,
  41  |     });
  42  | 
  43  |     const submitRes = await api.submitPostage(MSG_ID, PAYMENT_HASH, "100");
> 44  |     expect(submitRes.status()).toBe(201);
      |                                ^ Error: expect(received).toBe(expected) // Object.is equality
  45  |     const { data: pending } = await submitRes.json();
  46  |     expect(pending.status).toBe("pending");
  47  | 
  48  |     // Settle as recipient (ACTOR)
  49  |     const settleRes = await page.request.post(`/api/v1/postage/${MSG_ID}/settle`, {
  50  |       headers: {
  51  |         "Content-Type": "application/json",
  52  |         "x-stealth-address": ACTOR,
  53  |       },
  54  |     });
  55  |     expect(settleRes.status()).toBe(200);
  56  |     const { data: settled } = await settleRes.json();
  57  |     expect(settled.status).toBe("settled");
  58  |   });
  59  | 
  60  |   test("submits postage and then refunds it", async ({ page, api }) => {
  61  |     // Use different IDs to avoid collision with other tests
  62  |     const msgId = "c".repeat(64);
  63  |     const payHash = "d".repeat(64);
  64  | 
  65  |     await api.putPolicy(ACTOR, { allowUnknown: true, minimumPostage: "0", requireVerified: false });
  66  | 
  67  |     const submitRes = await page.request.post("/api/v1/postage/", {
  68  |       headers: { "Content-Type": "application/json", "x-stealth-address": SENDER },
  69  |       data: {
  70  |         amount: "50",
  71  |         messageId: msgId,
  72  |         paymentHash: payHash,
  73  |         recipient: ACTOR,
  74  |         sender: SENDER,
  75  |       },
  76  |     });
  77  |     expect(submitRes.status()).toBe(201);
  78  | 
  79  |     const refundRes = await page.request.post(`/api/v1/postage/${msgId}/refund`, {
  80  |       headers: { "Content-Type": "application/json", "x-stealth-address": ACTOR },
  81  |     });
  82  |     expect(refundRes.status()).toBe(200);
  83  |     const { data } = await refundRes.json();
  84  |     expect(data.status).toBe("refunded");
  85  |   });
  86  | 
  87  |   test("rejects duplicate postage submission with 409", async ({ api }) => {
  88  |     const msgId = "e".repeat(64);
  89  |     const payHash = "f".repeat(64);
  90  | 
  91  |     await api.putPolicy(ACTOR, { allowUnknown: true, minimumPostage: "0", requireVerified: false });
  92  | 
  93  |     const first = await api.submitPostage(msgId, payHash, "0");
  94  |     expect(first.status()).toBe(201);
  95  | 
  96  |     const second = await api.submitPostage(msgId, payHash, "0");
  97  |     expect(second.status()).toBe(409);
  98  |   });
  99  | 
  100 |   test("rejects postage below mailbox minimum with 422", async ({ api }) => {
  101 |     await api.putPolicy(ACTOR, {
  102 |       allowUnknown: true,
  103 |       minimumPostage: "1000",
  104 |       requireVerified: false,
  105 |     });
  106 | 
  107 |     const msgId = "9".repeat(64);
  108 |     const payHash = "8".repeat(64);
  109 |     const res = await api.submitPostage(msgId, payHash, "1");
  110 |     expect(res.status()).toBe(422);
  111 |   });
  112 | });
  113 | 
```