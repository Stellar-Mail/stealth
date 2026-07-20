import { expect, test as base, type Page } from "@playwright/test";
import { Keypair } from "@stellar/stellar-sdk";

import { buildActorSignaturePayload } from "../../src/server/api/actor";

export type TestIdentity = {
  address: string;
  keypair: Keypair;
};

export function createIdentity(): TestIdentity {
  const keypair = Keypair.random();
  return { address: keypair.publicKey(), keypair };
}

export const ACTOR_IDENTITY = createIdentity();
export const SENDER_IDENTITY = createIdentity();
export const ACTOR = ACTOR_IDENTITY.address;
export const SENDER = SENDER_IDENTITY.address;

export const MSG_ID = "a".repeat(64);
export const PAYMENT_HASH = "b".repeat(64);

export class ApiHelper {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async request(
    method: string,
    path: string,
    identity: TestIdentity,
    data?: Record<string, unknown>,
  ) {
    const body = data === undefined ? undefined : JSON.stringify(data);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomUUID().replaceAll("-", "");
    const request = new Request(new URL(path, "http://localhost"), {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body,
    });
    const payload = await buildActorSignaturePayload(request, identity.address, timestamp, nonce);

    return this.page.request.fetch(path, {
      method,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        "user-agent": `stealth-e2e-${identity.address.slice(1, 12)}`,
        "x-stealth-address": identity.address,
        "x-stealth-nonce": nonce,
        "x-stealth-relay-id": `relay-${identity.address.slice(1, 12)}`,
        "x-stealth-signature": Buffer.from(identity.keypair.sign(payload)).toString("base64"),
        "x-stealth-timestamp": timestamp,
      },
      data: body,
    });
  }

  async putPolicy(
    actor = ACTOR_IDENTITY,
    policy = { allowUnknown: true, minimumPostage: "0", requireVerified: false },
  ) {
    return this.request("PUT", `/api/v1/policies/${actor.address}`, actor, policy);
  }

  async getPolicy(owner = ACTOR_IDENTITY, actor = owner) {
    return this.request("GET", `/api/v1/policies/${owner.address}`, actor);
  }

  async setSenderRule(
    owner = ACTOR_IDENTITY,
    sender = SENDER_IDENTITY,
    rule: "allow" | "block" | "default",
  ) {
    const path = `/api/v1/policies/${owner.address}/senders/${sender.address}`;
    return rule === "default"
      ? this.request("DELETE", path, owner)
      : this.request("PUT", path, owner, { rule });
  }

  async quotePostage(recipient = ACTOR_IDENTITY, sender = SENDER_IDENTITY) {
    return this.request("POST", "/api/v1/postage/quote", sender, {
      recipient: recipient.address,
      sender: sender.address,
    });
  }

  async submitPostage(
    messageId = MSG_ID,
    paymentHash = PAYMENT_HASH,
    amount = "100",
    recipient = ACTOR_IDENTITY,
    sender = SENDER_IDENTITY,
  ) {
    return this.request("POST", "/api/v1/postage/", sender, {
      amount,
      messageId,
      paymentHash,
      recipient: recipient.address,
      sender: sender.address,
    });
  }

  async settlePostage(messageId = MSG_ID, recipient = ACTOR_IDENTITY) {
    return this.request("POST", `/api/v1/postage/${messageId}/settle`, recipient);
  }

  async refundPostage(messageId = MSG_ID, recipient = ACTOR_IDENTITY) {
    return this.request("POST", `/api/v1/postage/${messageId}/refund`, recipient);
  }

  async createReceipt(messageId = MSG_ID, recipient = ACTOR_IDENTITY, sender = SENDER_IDENTITY) {
    return this.request("POST", "/api/v1/receipts/", sender, {
      messageId,
      recipient: recipient.address,
      sender: sender.address,
    });
  }

  async getReceipt(messageId = MSG_ID, actor = ACTOR_IDENTITY) {
    return this.request("GET", `/api/v1/receipts/${messageId}`, actor);
  }

  async markReceiptRead(messageId = MSG_ID, actor = ACTOR_IDENTITY) {
    return this.request("POST", `/api/v1/receipts/${messageId}/read`, actor);
  }
}

const demoUiPreferences = {
  theme: "dark",
  compactMode: false,
  density: "comfortable",
  glassIntensity: "medium",
  readerTypography: "sans",
  lowerMotion: false,
  showAvatars: true,
  receiptOnDelivery: false,
  emailNotifications: true,
  desktopNotifications: true,
  sound: false,
  unknownSenders: "request",
  minimumPostage: "0.0001",
  onboardingCompleted: true,
  receipts: {
    trusted: "auto",
    unknown: "manual",
    paid: "manual",
    organizations: "auto",
  },
};

const demoLayoutPreferences = {
  sidebarWidth: 15,
  sidebarCollapsed: false,
  listWidth: 30,
  readerWidth: 35,
  compactMode: false,
  rightPanelCollapsed: false,
};

export async function openDemoMailbox(page: Page) {
  await page.addInitScript(
    ({ layout, preferences }) => {
      localStorage.setItem("stealth-preferences", JSON.stringify({ onboardingCompleted: true }));
      localStorage.setItem("stealth-ui-preferences", JSON.stringify(preferences));
      localStorage.setItem("stealth-layout-preferences", JSON.stringify(layout));
    },
    {
      layout: demoLayoutPreferences,
      preferences: demoUiPreferences,
    },
  );

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Inbox/i })).toBeVisible();
  await page.waitForFunction(() => Boolean(document.documentElement.dataset.theme));
}

type Fixtures = { api: ApiHelper };

export const test = base.extend<Fixtures>({
  api: async ({ page }, use) => {
    await use(new ApiHelper(page));
  },
});

export { expect } from "@playwright/test";
