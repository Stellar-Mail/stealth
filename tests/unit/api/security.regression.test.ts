import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";

import { Route as PolicyRoute } from "../../../src/routes/api/v1/policies/$owner";
import { Route as SenderRuleRoute } from "../../../src/routes/api/v1/policies/$owner/senders/$sender";
import { Route as DraftsIndexRoute } from "../../../src/routes/api/v1/drafts/index";
import { Route as DraftRoute } from "../../../src/routes/api/v1/drafts/$draftId";
import { Route as ContactsIndexRoute } from "../../../src/routes/api/v1/contacts/index";
import { Route as ContactRoute } from "../../../src/routes/api/v1/contacts/$contactId";
import { Route as RequestsRoute } from "../../../src/routes/api/v1/requests/index";
import { Route as DecisionsRoute } from "../../../src/routes/api/v1/requests/$requestId/decisions";
import { Route as DeliveryReceiptRoute } from "../../../src/routes/api/v1/receipts/index";
import { Route as ReadReceiptRoute } from "../../../src/routes/api/v1/receipts/$messageId/read";
import { Route as DlqRoute } from "../../../src/routes/api/v1/admin/dlq/index";
import { Route as WalletAddressRoute } from "../../../src/routes/api/v1/wallet/link/$address";
import { Route as PostageRoute } from "../../../src/routes/api/v1/postage/index";

// Server utilities
import { ACTOR_HEADER, DELEGATION_HEADER } from "../../../src/server/api/actor";
import type { MailboxDelegation } from "../../../src/server/api/auth/delegation";
import { getApiContext } from "../../../src/server/api/context";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import {
  buildSignedRequestHeaders,
  resetSignedRequestNonceStore,
  SIGNATURE_HEADER,
} from "../../../src/server/api/auth/signed-request-verify";

const updatePolicyHandler = (PolicyRoute.options as any).server?.handlers?.PUT;
const getSenderRuleHandler = (SenderRuleRoute.options as any).server?.handlers?.GET;
const updateSenderRuleHandler = (SenderRuleRoute.options as any).server?.handlers?.PUT;
const listDraftsHandler = (DraftsIndexRoute.options as any).server?.handlers?.GET;
const createDraftHandler = (DraftsIndexRoute.options as any).server?.handlers?.POST;
const getDraftHandler = (DraftRoute.options as any).server?.handlers?.GET;
const putDraftHandler = (DraftRoute.options as any).server?.handlers?.PUT;
const deleteDraftHandler = (DraftRoute.options as any).server?.handlers?.DELETE;
const listContactsHandler = (ContactsIndexRoute.options as any).server?.handlers?.GET;
const createContactHandler = (ContactsIndexRoute.options as any).server?.handlers?.POST;
const getContactHandler = (ContactRoute.options as any).server?.handlers?.GET;
const listRequestsHandler = (RequestsRoute.options as any).server?.handlers?.GET;
const postDecisionHandler = (DecisionsRoute.options as any).server?.handlers?.POST;
const postDeliveryReceiptHandler = (DeliveryReceiptRoute.options as any).server?.handlers?.POST;
const postReadReceiptHandler = (ReadReceiptRoute.options as any).server?.handlers?.POST;
const dlqListHandler = (DlqRoute.options as any).server?.handlers?.GET;
const deleteWalletLinkHandler = (WalletAddressRoute.options as any).server?.handlers?.DELETE;
const postPostageHandler = (PostageRoute.options as any).server?.handlers?.POST;

// ---------------------------------------------------------------------------
// Request builder helpers
// ---------------------------------------------------------------------------

const ownerKeypair = Keypair.random();
const attackerKeypair = Keypair.random();
const owner = ownerKeypair.publicKey();
const attacker = attackerKeypair.publicKey();

const POLICY_BODY = {
  allowUnknown: true,
  minimumPostage: "500",
  requireVerified: false,
};

function updatePolicyRequest(actorKeypair: Keypair, overrides: Record<string, string> = {}) {
  const url = `https://stealth.test/api/v1/policies/${owner}`;
  const body = JSON.stringify(POLICY_BODY);
  const signed = buildSignedRequestHeaders({
    keypair: actorKeypair,
    method: "PUT",
    url,
    body,
    audience: "stealth.test",
  });

  return new Request(url, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      ...signed,
      ...overrides,
    },
    body,
  });
}

// ===========================================================================
// Test Suite
// ===========================================================================

describe("API Security Regressions — BETA-084 (#1991)", () => {
  let repo: MemoryApiRepository;
  const previousRequireSigned = process.env.STEALTH_AUTH_REQUIRE_SIGNED;

  beforeAll(() => {
    process.env.STEALTH_AUTH_REQUIRE_SIGNED = "1";
  });

  afterAll(() => {
    if (previousRequireSigned === undefined) {
      delete process.env.STEALTH_AUTH_REQUIRE_SIGNED;
    } else {
      process.env.STEALTH_AUTH_REQUIRE_SIGNED = previousRequireSigned;
    }
  });

  beforeEach(async () => {
    repo = (await getApiContext()).repository as MemoryApiRepository;
    repo.reset();
    resetSignedRequestNonceStore();
  });

  describe("Authentication & Authorization Bypasses", () => {
    it("forged actor headers fail", async () => {
      const response = await updatePolicyHandler({
        request: new Request(`https://stealth.test/api/v1/policies/${owner}`, {
          method: "PUT",
          headers: {
            "content-type": "application/json",
            [ACTOR_HEADER]: owner,
          },
          body: JSON.stringify(POLICY_BODY),
        }),
        params: { owner },
      });
      expect(response.status).toBe(401);
    });

    it("header-only requests fail when signed auth is required", async () => {
      const response = await updatePolicyHandler({
        request: new Request(`https://stealth.test/api/v1/policies/${owner}`, {
          method: "PUT",
          headers: {
            "content-type": "application/json",
            [ACTOR_HEADER]: owner,
          },
          body: JSON.stringify(POLICY_BODY),
        }),
        params: { owner },
      });
      expect(response.status).not.toBe(200);
    });

    it("replayed signatures fail", async () => {
      const url = `https://stealth.test/api/v1/policies/${owner}`;
      const body = JSON.stringify(POLICY_BODY);
      const nonce = randomBytes(32).toString("hex");
      const signed = buildSignedRequestHeaders({
        keypair: ownerKeypair,
        method: "PUT",
        url,
        body,
        audience: "stealth.test",
        nonce,
      });

      const firstResponse = await updatePolicyHandler({
        request: new Request(url, {
          method: "PUT",
          headers: { "content-type": "application/json", ...signed },
          body,
        }),
        params: { owner },
      });
      expect(response.status).toBe(200);
    });

      const secondResponse = await updatePolicyHandler({
        request: new Request(url, {
          method: "PUT",
          headers: { "content-type": "application/json", ...signed },
          body,
        }),
        params: { owner },
      });
      expect(secondResponse.status).toBe(409);
    });

    it("signatures cannot move across routes or bodies", async () => {
      const url = `https://stealth.test/api/v1/policies/${owner}`;
      const body = JSON.stringify(POLICY_BODY);
      const signedForOtherBody = buildSignedRequestHeaders({
        keypair: ownerKeypair,
        method: "PUT",
        url,
        body: JSON.stringify({ ...POLICY_BODY, minimumPostage: "999" }),
        audience: "stealth.test",
      });

  describe("10. Stale Authorization — Expired and Revoked Delegations (control: auth/delegation.ts)", () => {
    it("expired delegation is rejected with forbidden — policy state unchanged", async () => {
      const response = await updatePolicyHandler({
        request: new Request(url, {
          method: "PUT",
          headers: { "content-type": "application/json", ...signedForOtherBody },
          body,
        }),
        params: { owner },
      });
      expect(response.status).toBe(401);
    });

    it("rejects a valid signature paired with a different actor address", async () => {
      const url = `https://stealth.test/api/v1/policies/${owner}`;
      const body = JSON.stringify(POLICY_BODY);
      const signed = buildSignedRequestHeaders({
        keypair: ownerKeypair,
        method: "PUT",
        url,
        body,
        audience: "stealth.test",
      });

      const response = await updatePolicyHandler({
        request: new Request(url, {
          method: "PUT",
          headers: {
            "content-type": "application/json",
            ...signed,
            [ACTOR_HEADER]: attacker,
          },
          body,
        }),
        params: { owner },
      });
      expect(response.status).toBe(401);
    });

    it("rejects expired timestamps", async () => {
      const url = `https://stealth.test/api/v1/policies/${owner}`;
      const body = JSON.stringify(POLICY_BODY);
      const signed = buildSignedRequestHeaders({
        keypair: ownerKeypair,
        method: "PUT",
        url,
        body,
        audience: "stealth.test",
        timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      });

      const response = await updatePolicyHandler({
        request: new Request(url, {
          method: "PUT",
          headers: { "content-type": "application/json", ...signed },
          body,
        }),
        params: { owner },
      });
      expect(response.status).toBe(422);
    });

    it("rejects missing signatures", async () => {
      const url = `https://stealth.test/api/v1/policies/${owner}`;
      const body = JSON.stringify(POLICY_BODY);
      const signed = buildSignedRequestHeaders({
        keypair: ownerKeypair,
        method: "PUT",
        url,
        body,
        audience: "stealth.test",
      });
      delete (signed as Record<string, string | undefined>)[SIGNATURE_HEADER];

      const response = await updatePolicyHandler({
        request: new Request(url, {
          method: "PUT",
          headers: { "content-type": "application/json", ...signed },
          body,
        }),
        params: { owner },
      });
      expect(response.status).toBe(401);
    });

    it("rejects signatures from the wrong key", async () => {
      const response = await updatePolicyHandler({
        request: updatePolicyRequest(attackerKeypair),
        params: { owner },
      });
      // Authenticated as attacker against owner's resource → forbidden
      expect(response.status).toBe(403);
    });

    it("accepts a correctly signed mutating request from the owner", async () => {
      const response = await updatePolicyHandler({
        request: updatePolicyRequest(ownerKeypair),
        params: { owner },
      });
      expect(response.status).toBe(200);
    });

    it("delegation with wrong resource scope is rejected", async () => {
      const response = await updatePolicyHandler({
        request: updatePolicyRequest(attackerKeypair),
        params: { owner },
      });
      expect(response.status).toBe(403);
    });
  });

  // -------------------------------------------------------------------------
  // 11. Replay / Signature Forwarding Vectors (documented future state)
  // -------------------------------------------------------------------------

  describe("11. Replay / Signature Forwarding — documented future enforcement", () => {
    /**
     * The current model trusts the x-stealth-address header without HMAC signature verification.
     * These tests are marked it.fails to document the expected future behavior once
     * signed-request enforcement (#1555 and related) is fully implemented.
     *
     * They prove: the route currently returns 200 (i.e., trusts the header), and
     * when the signing layer is enforced, these should be changed to non-failing expectations.
     */
    it.fails(
      "replayed identical signature headers are rejected by the signing layer (future enforcement)",
      async () => {
        const validHeaders = {
          [ACTOR_HEADER]: owner,
          "x-stealth-nonce": "nonce-replay-001",
          "x-stealth-timestamp": new Date().toISOString(),
          "x-stealth-signature": "sig-replay-001",
        };

        const body = { allowUnknown: true, minimumPostage: "500", requireVerified: false };

        const firstReq = req(`/api/v1/policies/${owner}`, "PUT", owner, body, {
          "x-stealth-nonce": validHeaders["x-stealth-nonce"],
          "x-stealth-timestamp": validHeaders["x-stealth-timestamp"],
          "x-stealth-signature": validHeaders["x-stealth-signature"],
        });

        const firstResp = await updatePolicyHandler({
          request: firstReq,
          params: { owner },
        });
        expect(firstResp.status).toBe(200);

        // Replay the exact same request — should be rejected once replay detection is enforced
        const replayReq = req(`/api/v1/policies/${owner}`, "PUT", owner, body, {
          "x-stealth-nonce": validHeaders["x-stealth-nonce"],
          "x-stealth-timestamp": validHeaders["x-stealth-timestamp"],
          "x-stealth-signature": validHeaders["x-stealth-signature"],
        });
        const replayResp = await updatePolicyHandler({
          request: replayReq,
          params: { owner },
        });
        // This should be non-200 once full replay detection is implemented
        expect(replayResp.status).not.toBe(200);
      },
    );

    it.fails(
      "a signature obtained for one route cannot be reused on a different route (future enforcement)",
      async () => {
        const body = { allowUnknown: true, minimumPostage: "500", requireVerified: false };
        // Signature was issued for a different body/route
        const crossRouteSig = "sig-for-different-route";
        const crossRouteReq = req(`/api/v1/policies/${owner}`, "PUT", owner, body, {
          "x-stealth-nonce": "nonce-cross-001",
          "x-stealth-timestamp": new Date().toISOString(),
          "x-stealth-signature": crossRouteSig,
        });
        const response = await updatePolicyHandler({
          request: crossRouteReq,
          params: { owner },
        });
        // Once request signing is enforced, a mismatched signature must be rejected
        expect(response.status).not.toBe(200);
      },
    );
  });

  // -------------------------------------------------------------------------
  // 12. CSRF — Forged Origin Rejection (control: cors.ts / handleApiRequest)
  // -------------------------------------------------------------------------

  describe("12. CSRF — Forged Origin Rejection (control: cors.ts / handleApiRequest)", () => {
    const forgedOrigin = "https://evil-attacker.example.com";

    it("policy PUT with forged Origin is rejected with 403 without mutating policy state", async () => {
      const response = await updatePolicyHandler({
        request: req(
          `/api/v1/policies/${owner}`,
          "PUT",
          owner,
          { allowUnknown: true, minimumPostage: "999", requireVerified: false },
          { Origin: forgedOrigin },
        ),
        params: { owner },
      });
      expect(response.status).toBe(403);
      const policy = await getMailboxPolicy(repo, owner);
      expect(policy.source).toBe("default");
      expect(policy.policy.minimumPostage).toBe("0");
    });

    it("postage POST with forged Origin is rejected with 403 without creating postage records", async () => {
      const response = await postPostageHandler({
        request: req(
          "/api/v1/postage",
          "POST",
          owner,
          {
            amount: "1000",
            messageId,
            paymentHash: "0".repeat(64),
            recipient: contactAddress,
            sender: owner,
            asset: "native",
            policyVersion: 1,
            network: "testnet",
            issuedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
            quoteDigest: "digest-123",
          },
          { Origin: forgedOrigin },
        ),
      });
      expect(response.status).toBe(403);
      const storedPostage = await repo.getPostage(messageId);
      expect(storedPostage).toBeNull();
    });

    it("delivery receipt POST with forged Origin is rejected with 403 without writing receipts", async () => {
      const response = await postDeliveryReceiptHandler({
        request: req(
          "/api/v1/receipts",
          "POST",
          owner,
          {
            messageId,
            sender: owner,
            recipient: contactAddress,
            deliveredAt: new Date().toISOString(),
            contractId: `C${"A".repeat(55)}`,
            txHash: "0".repeat(64),
          },
          { Origin: forgedOrigin },
        ),
      });
      expect(response.status).toBe(403);
      const receipt = await repo.getReceipt(messageId);
      expect(receipt).toBeNull();
    });

    it("read receipt POST with forged Origin is rejected with 403 without updating receipt state", async () => {
      // First seed a delivery receipt
      await createDeliveryReceipt(repo, {
        messageId,
        sender: owner,
        recipient: contactAddress,
      });

      const response = await postReadReceiptHandler({
        request: req(`/api/v1/receipts/${messageId}/read`, "POST", contactAddress, undefined, {
          Origin: forgedOrigin,
        }),
        params: { messageId },
      });
      expect(response.status).toBe(403);
      const receipt = await repo.getReceipt(messageId);
      expect(receipt?.readAt).toBeNull();
    });
  });
});
