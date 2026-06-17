import { test as base, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Deterministic Stellar addresses used across all tests
// ---------------------------------------------------------------------------
export const ACTOR = `G${"A".repeat(55)}`;
export const SENDER = `G${"B".repeat(55)}`;

// A deterministic 32-byte hex hash
export const MSG_ID = "a".repeat(64);
export const PAYMENT_HASH = "b".repeat(64);

// ---------------------------------------------------------------------------
// API helpers – thin wrappers around page.request so tests stay readable
// ---------------------------------------------------------------------------
export class ApiHelper {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  private headers(actor = ACTOR) {
    return {
      "Content-Type": "application/json",
      "user-agent": `stealth-e2e-${actor.slice(1, 12)}`,
      "x-stealth-address": actor,
      "x-stealth-relay-id": `relay-${actor.slice(1, 12)}`,
    };
  }

  async putPolicy(
    actor = ACTOR,
    policy = { allowUnknown: true, minimumPostage: "0", requireVerified: false },
  ) {
    return this.page.request.put(`/api/v1/policies/${actor}`, {
      headers: this.headers(actor),
      data: policy,
    });
  }

  async getPolicy(owner = ACTOR) {
    return this.page.request.get(`/api/v1/policies/${owner}`, {
      headers: this.headers(),
    });
  }

  async setSenderRule(owner = ACTOR, sender = SENDER, rule: "allow" | "block" | "default") {
    if (rule === "default") {
      return this.page.request.delete(`/api/v1/policies/${owner}/senders/${sender}`, {
        headers: this.headers(owner),
      });
    }

    return this.page.request.put(`/api/v1/policies/${owner}/senders/${sender}`, {
      headers: this.headers(owner),
      data: { rule },
    });
  }

  async quotePostage(recipient = ACTOR, sender = SENDER) {
    return this.page.request.post("/api/v1/postage/quote", {
      headers: this.headers(sender),
      data: { recipient, sender },
    });
  }

  async submitPostage(
    messageId = MSG_ID,
    paymentHash = PAYMENT_HASH,
    amount = "100",
    recipient = ACTOR,
    sender = SENDER,
  ) {
    return this.page.request.post("/api/v1/postage/", {
      headers: this.headers(sender),
      data: { amount, messageId, paymentHash, recipient, sender },
    });
  }

  async settlePostage(messageId = MSG_ID) {
    return this.page.request.patch(`/api/v1/postage/${messageId}`, {
      headers: this.headers(ACTOR),
      data: { status: "settled" },
    });
  }

  async refundPostage(messageId = MSG_ID) {
    return this.page.request.patch(`/api/v1/postage/${messageId}`, {
      headers: this.headers(ACTOR),
      data: { status: "refunded" },
    });
  }
}

// ---------------------------------------------------------------------------
// Extended test fixture that exposes the API helper and pre-loads the app
// ---------------------------------------------------------------------------
type Fixtures = { api: ApiHelper };

export const test = base.extend<Fixtures>({
  api: async ({ page }, use) => {
    await use(new ApiHelper(page));
  },
});

export { expect } from "@playwright/test";
