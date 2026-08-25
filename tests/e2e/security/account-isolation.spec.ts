/**
 * BETA-084 (Issue #1991) — Playwright cross-account API security probes.
 */

import { expect, test } from "@playwright/test";
import { assertNoSecretsLeaked } from "../../fixtures/identity";

const ALICE = `G${"A".repeat(55)}`;
const BOB = `G${"B".repeat(55)}`;
const SENDER = `G${"D".repeat(55)}`;
const MSG_ID = "e".repeat(64);

function headers(actor: string) {
  return {
    "Content-Type": "application/json",
    "x-stealth-address": actor,
    "x-stealth-relay-id": `relay-${actor.slice(1, 8)}`,
  };
}

test.describe("BETA-084 (Issue #1991): E2E Account Isolation", () => {
  test("denies cross-account policy mutation", async ({ request }) => {
    const res = await request.put(`/api/v1/policies/${ALICE}`, {
      headers: headers(BOB),
      data: { allowUnknown: true, minimumPostage: "999", requireVerified: false },
    });
    expect(res.status()).toBe(403);
    assertNoSecretsLeaked(await res.json());
  });

  test("allows owner policy mutation (control path)", async ({ request }) => {
    const res = await request.put(`/api/v1/policies/${ALICE}`, {
      headers: headers(ALICE),
      data: { allowUnknown: true, minimumPostage: "0", requireVerified: false },
    });
    expect(res.status()).toBe(200);
    assertNoSecretsLeaked(await res.json());
  });

  test("scopes mailbox queue to authenticated recipient", async ({ request }) => {
    const res = await request.get("/api/v1/mailbox/queue", { headers: headers(BOB) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    for (const item of body.data.items) {
      expect(item.recipientId).toBe(BOB);
    }
  });

  test("denies cross-account mailbox message read", async ({ request }) => {
    const res = await request.get(`/api/v1/mailbox/${MSG_ID}`, { headers: headers(BOB) });
    expect([403, 404]).toContain(res.status());
  });

  test("denies cross-account sender rule mutation", async ({ request }) => {
    const res = await request.put(`/api/v1/policies/${ALICE}/senders/${SENDER}`, {
      headers: headers(BOB),
      data: { rule: "block" },
    });
    expect(res.status()).toBe(403);
  });

  test("denies unauthenticated profile access", async ({ request }) => {
    expect((await request.get("/api/v1/accounts/profile")).status()).toBe(401);
  });
});
