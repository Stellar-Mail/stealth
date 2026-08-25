/**
 * BETA-084 (Issue #1991) — Cross-account IDOR regression matrix.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { Route as ProfileRoute } from "@/routes/api/v1/accounts/profile";
import { Route as ContactRoute } from "@/routes/api/v1/contacts/$contactId";
import { Route as ContactsIndexRoute } from "@/routes/api/v1/contacts/index";
import { Route as DraftRoute } from "@/routes/api/v1/onboarding/draft";
import { Route as ComposeDraftRoute } from "@/routes/api/v1/drafts/$draftId";
import { Route as PolicyRoute } from "@/routes/api/v1/policies/$owner";
import { Route as RequestsRoute } from "@/routes/api/v1/requests/index";
import { Route as DecisionsRoute } from "@/routes/api/v1/requests/$requestId/decisions";
import { Route as SettleRoute } from "@/routes/api/v1/postage/$messageId/settle";
import { Route as DeliveryRoute } from "@/routes/api/v1/receipts/index";
import { Route as ReadReceiptRoute } from "@/routes/api/v1/receipts/$messageId/read";
import { Route as WalletLinkRoute } from "@/routes/api/v1/wallet/link/$address";
import { Route as MailboxMessageRoute } from "@/routes/api/v1/mailbox/$messageId";
import { Route as MailboxQueueRoute } from "@/routes/api/v1/mailbox/queue";
import { ACTOR_HEADER } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import type { MemoryApiRepository } from "@/server/api/memory-repository";
import { getRouteHandler } from "../../../helpers/route-handler";
import { assertNoSecretsLeaked } from "../../../fixtures/identity";
import {
  ALICE_ADDRESS,
  BOB_ADDRESS,
  CHARLIE_ADDRESS,
  DRAFT_ID,
  MESSAGE_ID,
  REQUEST_ID,
  SENDER_ADDRESS,
  classifyDenial,
  seedAliceComposeDraft,
  seedAliceContact,
  seedAliceExternalWallet,
  seedAliceMailbox,
  seedAlicePostage,
  seedAliceSenderRequest,
  seedTwoUserIsolationFixture,
  sessionCookie,
  type TwoUserIsolationFixture,
} from "../../../fixtures/security-isolation";

function actorRequest(path: string, method: string, actor?: string, body?: unknown): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (actor !== undefined) headers[ACTOR_HEADER] = actor;
  const init: RequestInit = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);
  return new Request(`https://stealth.test${path}`, init);
}

function cookieRequest(path: string, method: string, cookie: string, body?: unknown): Request {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    Cookie: cookie,
  };
  const init: RequestInit = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);
  return new Request(`https://stealth.test${path}`, init);
}

describe("BETA-084 (Issue #1991): Account Isolation IDOR Matrix", () => {
  let fixture: TwoUserIsolationFixture;
  let repo: MemoryApiRepository;

  beforeEach(async () => {
    fixture = await seedTwoUserIsolationFixture();
    repo = (await getApiContext()).repository as MemoryApiRepository;
  });

  describe("profiles", () => {
    it("returns only the authenticated actor's profile without secret leakage", async () => {
      const aliceRes = await getRouteHandler(
        ProfileRoute,
        "GET",
      )({
        request: actorRequest("/api/v1/accounts/profile", "GET", ALICE_ADDRESS),
      });
      expect(aliceRes.status).toBe(200);
      const aliceBody = await aliceRes.json();
      expect(aliceBody.data.profile.displayName).toBe("Alice Smith");
      assertNoSecretsLeaked(aliceBody);

      const bobRes = await getRouteHandler(
        ProfileRoute,
        "GET",
      )({
        request: actorRequest("/api/v1/accounts/profile", "GET", BOB_ADDRESS),
      });
      const bobBody = await bobRes.json();
      expect(bobBody.data.account.username).toBe("bob_jones");
      expect(bobBody.data.account.username).not.toBe(aliceBody.data.account.username);
    });
  });

  describe("policy", () => {
    it("denies Bob mutating Alice's mailbox policy", async () => {
      const res = await getRouteHandler(
        PolicyRoute,
        "PUT",
      )({
        request: actorRequest(`/api/v1/policies/${ALICE_ADDRESS}`, "PUT", BOB_ADDRESS, {
          allowUnknown: true,
          minimumPostage: "999",
          requireVerified: false,
        }),
        params: { owner: ALICE_ADDRESS },
      });
      expect(res.status).toBe(403);
      expect(classifyDenial(res.status)).toBe("denied");
    });
  });

  describe("contacts", () => {
    it("denies Bob reading Alice's contact by ID", async () => {
      const contactId = await seedAliceContact(repo);
      const res = await getRouteHandler(
        ContactRoute,
        "GET",
      )({
        request: actorRequest(`/api/v1/contacts/${contactId}`, "GET", BOB_ADDRESS),
        params: { contactId },
      });
      expect(res.status).toBe(404);
    });

    it("scopes contact lists to the authenticated actor", async () => {
      await seedAliceContact(repo);
      const res = await getRouteHandler(
        ContactsIndexRoute,
        "GET",
      )({
        request: actorRequest("/api/v1/contacts", "GET", BOB_ADDRESS),
      });
      const body = await res.json();
      expect(body.data.items).toHaveLength(0);
    });
  });

  describe("onboarding drafts (session-bound)", () => {
    it("denies Bob's session from reading Alice's onboarding draft", async () => {
      await repo.saveOnboardingDraft({
        userId: fixture.alice.user.userId,
        status: "in_progress",
        step: "recovery",
        displayName: "Alice Draft",
        recoveryAcknowledged: false,
        unknownSenderRule: "request",
        minimumPostage: "0",
        receiptOnDelivery: false,
        updatedAt: "2026-08-23T08:00:00.000Z",
        completedAt: null,
        version: 1,
      });

      const res = await getRouteHandler(
        DraftRoute,
        "GET",
      )({
        request: cookieRequest(
          "/api/v1/onboarding/draft",
          "GET",
          sessionCookie(fixture.bob.sessionId),
        ),
      });
      expect(res.status).toBe(200);
      expect((await res.json()).data.draft).toBeNull();
    });
  });

  describe("compose drafts (actor-bound)", () => {
    it("denies Bob reading Alice's encrypted compose draft", async () => {
      await seedAliceComposeDraft(repo);
      const res = await getRouteHandler(
        ComposeDraftRoute,
        "GET",
      )({
        request: actorRequest(`/api/v1/drafts/${DRAFT_ID}`, "GET", BOB_ADDRESS),
        params: { draftId: DRAFT_ID },
      });
      expect(classifyDenial(res.status)).toBe("denied");
    });
  });

  describe("mailbox", () => {
    beforeEach(async () => {
      await seedAliceMailbox(repo);
    });

    it("denies Bob reading Alice's message by ID", async () => {
      const res = await getRouteHandler(
        MailboxMessageRoute,
        "GET",
      )({
        request: actorRequest(`/api/v1/mailbox/${MESSAGE_ID}`, "GET", BOB_ADDRESS),
        params: { messageId: MESSAGE_ID },
      });
      expect(res.status).toBe(403);
    });

    it("does not include Alice's messages in Bob's queue", async () => {
      const res = await getRouteHandler(
        MailboxQueueRoute,
        "GET",
      )({
        request: actorRequest("/api/v1/mailbox/queue", "GET", BOB_ADDRESS),
      });
      const body = await res.json();
      const ids = body.data.items.map((item: { messageId: string }) => item.messageId);
      expect(ids).not.toContain(MESSAGE_ID);
    });
  });

  describe("sender requests", () => {
    beforeEach(async () => {
      await seedAliceSenderRequest(repo);
    });

    it("denies Bob listing Alice's pending sender requests", async () => {
      const res = await getRouteHandler(
        RequestsRoute,
        "GET",
      )({
        request: actorRequest("/api/v1/requests/", "GET", BOB_ADDRESS),
      });
      const body = await res.json();
      expect(body.data.items).toHaveLength(0);
    });

    it("denies Bob deciding Alice's sender request", async () => {
      const res = await getRouteHandler(
        DecisionsRoute,
        "POST",
      )({
        request: actorRequest(`/api/v1/requests/${REQUEST_ID}/decisions`, "POST", BOB_ADDRESS, {
          decision: "approve_once",
        }),
        params: { requestId: REQUEST_ID },
      });
      expect(classifyDenial(res.status)).toBe("denied");
      expect((await repo.getSenderRequest(REQUEST_ID))?.status).toBe("pending");
    });
  });

  describe("postage", () => {
    beforeEach(async () => {
      await seedAlicePostage(repo);
    });

    it("denies Bob settling Alice's held postage", async () => {
      const res = await getRouteHandler(
        SettleRoute,
        "POST",
      )({
        request: actorRequest(`/api/v1/postage/${MESSAGE_ID}/settle`, "POST", BOB_ADDRESS),
        params: { messageId: MESSAGE_ID },
      });
      expect(res.status).toBe(403);
    });
  });

  describe("receipts", () => {
    it("denies Bob publishing a delivery receipt as Alice's sender", async () => {
      const res = await getRouteHandler(
        DeliveryRoute,
        "POST",
      )({
        request: actorRequest("/api/v1/receipts", "POST", BOB_ADDRESS, {
          messageId: MESSAGE_ID,
          recipient: ALICE_ADDRESS,
          sender: SENDER_ADDRESS,
        }),
      });
      expect(res.status).toBe(403);
    });

    it("denies Bob publishing a read receipt for Alice's message", async () => {
      const res = await getRouteHandler(
        ReadReceiptRoute,
        "POST",
      )({
        request: actorRequest(`/api/v1/receipts/${MESSAGE_ID}/read`, "POST", BOB_ADDRESS),
        params: { messageId: MESSAGE_ID },
      });
      expect(classifyDenial(res.status)).toBe("denied");
    });
  });

  describe("wallets", () => {
    beforeEach(async () => {
      await seedAliceExternalWallet(repo);
    });

    it("denies Bob mutating Alice's linked external wallet", async () => {
      const res = await getRouteHandler(
        WalletLinkRoute,
        "PATCH",
      )({
        request: actorRequest(`/api/v1/wallet/link/${CHARLIE_ADDRESS}`, "PATCH", BOB_ADDRESS, {
          capabilities: ["sign"],
        }),
        params: { address: CHARLIE_ADDRESS },
      });
      expect(classifyDenial(res.status)).toBe("denied");
    });
  });

  describe("canonicalization", () => {
    it("denies Bob policy mutation with lowercase actor header", async () => {
      const res = await getRouteHandler(
        PolicyRoute,
        "PUT",
      )({
        request: actorRequest(
          `/api/v1/policies/${ALICE_ADDRESS}`,
          "PUT",
          BOB_ADDRESS.toLowerCase(),
          {
            allowUnknown: true,
            minimumPostage: "500",
            requireVerified: false,
          },
        ),
        params: { owner: ALICE_ADDRESS },
      });
      expect(res.status).toBe(403);
    });
  });
});
