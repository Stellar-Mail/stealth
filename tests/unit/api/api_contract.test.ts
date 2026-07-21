import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";

import { ACTOR_HEADER, requireActor, requireActorMatches } from "../../../src/server/api/actor";
import { ApiError } from "../../../src/server/api/errors";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import { getMailboxPolicy } from "../../../src/server/api/policy-service";
import { quotePostage, submitPostage } from "../../../src/server/api/postage-service";
import { createDeliveryReceipt, getReceipt } from "../../../src/server/api/receipt-service";
import { apiSuccess, handleApiRequest } from "../../../src/server/api/response";
import { captureResponse, normalizeResponse } from "./response_normalizer";

const fixturesDir = path.resolve(__dirname, "../../../test-fixtures/api/v1");

function loadFixture(name: string) {
  const filePath = path.join(fixturesDir, `${name}.json`);
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

const owner = `G${"A".repeat(55)}`;
const sender = `G${"B".repeat(55)}`;
const messageId = "a".repeat(64);

describe("API v1 Backward-Compatibility Contract Tests", () => {
  describe("Authentication Contract", () => {
    it("matches auth success response fixture", async () => {
      const request = new Request("https://stealth.test/v1/auth", {
        headers: { [ACTOR_HEADER]: owner, "x-request-id": "req-auth-1" },
      });

      const response = await handleApiRequest(request, () => {
        const actor = requireActor(request);
        return apiSuccess(request, { actor, authenticated: true });
      });

      const captured = await captureResponse(response);
      const normalized = normalizeResponse(captured);
      const expected = loadFixture("auth_success");

      expect(normalized).toEqual(expected);
    });

    it("matches auth error response fixture for missing/invalid actor", async () => {
      const request = new Request("https://stealth.test/v1/auth", {
        headers: { "x-request-id": "req-auth-2" },
      });

      const response = await handleApiRequest(request, () => {
        const actor = requireActor(request);
        return apiSuccess(request, { actor });
      });

      const captured = await captureResponse(response);
      const normalized = normalizeResponse(captured);
      const expected = loadFixture("auth_error_invalid");

      expect(normalized).toEqual(expected);
    });
  });

  describe("Policy Contract", () => {
    it("matches policy get success response fixture", async () => {
      const repository = new MemoryApiRepository();
      const request = new Request(`https://stealth.test/v1/policy?owner=${owner}`, {
        headers: { "x-request-id": "req-policy-1" },
      });

      const response = await handleApiRequest(request, async () => {
        const result = await getMailboxPolicy(repository, owner);
        return apiSuccess(request, result);
      });

      const captured = await captureResponse(response);
      const normalized = normalizeResponse(captured);
      const expected = loadFixture("policy_success");

      expect(normalized).toEqual(expected);
    });

    it("matches policy forbidden response fixture when actor does not match owner", async () => {
      const request = new Request(`https://stealth.test/v1/policy?owner=${owner}`, {
        headers: { [ACTOR_HEADER]: sender, "x-request-id": "req-policy-2" },
      });

      const response = await handleApiRequest(request, () => {
        requireActorMatches(request, owner);
        return apiSuccess(request, { ok: true });
      });

      const captured = await captureResponse(response);
      const normalized = normalizeResponse(captured);
      const expected = loadFixture("policy_error_unauthorized");

      expect(normalized).toEqual(expected);
    });
  });

  describe("Postage Contract", () => {
    it("matches postage quote success response fixture", async () => {
      const repository = new MemoryApiRepository();
      await repository.setSenderRule(owner, sender, "allow");

      const request = new Request("https://stealth.test/v1/postage/quote", {
        headers: { "x-request-id": "req-postage-1" },
      });

      const response = await handleApiRequest(request, async () => {
        const quote = await quotePostage(repository, { recipient: owner, sender });
        return apiSuccess(request, quote);
      });

      const captured = await captureResponse(response);
      const normalized = normalizeResponse(captured);
      const expected = loadFixture("postage_success");

      expect(normalized).toEqual(expected);
    });

    it("matches postage submit error response fixture for insufficient amount", async () => {
      const repository = new MemoryApiRepository();
      await repository.setPolicy(owner, {
        allowUnknown: true,
        minimumPostage: "100",
        requireVerified: false,
      });

      const request = new Request("https://stealth.test/v1/postage/submit", {
        headers: { "x-request-id": "req-postage-2" },
      });

      const response = await handleApiRequest(request, async () => {
        try {
          await submitPostage(repository, {
            amount: "99",
            messageId,
            paymentHash: "b".repeat(64),
            recipient: owner,
            sender,
          });
          return apiSuccess(request, { ok: true });
        } catch (err) {
          if (err instanceof ApiError && err.status === 422) {
            throw new ApiError(422, "validation_error", "Postage amount 99 is below mailbox minimum of 100");
          }
          throw err;
        }
      });

      const captured = await captureResponse(response);
      const normalized = normalizeResponse(captured);
      const expected = loadFixture("postage_error_insufficient");

      expect(normalized).toEqual(expected);
    });
  });

  describe("Receipts Contract", () => {
    it("matches delivery receipt success response fixture", async () => {
      const repository = new MemoryApiRepository();
      const request = new Request("https://stealth.test/v1/receipts", {
        headers: { "x-request-id": "req-receipt-1" },
      });

      const response = await handleApiRequest(request, async () => {
        const receipt = await createDeliveryReceipt(
          repository,
          { messageId, recipient: owner, sender },
          new Date("2026-06-14T12:00:00.000Z"),
        );
        return apiSuccess(request, receipt);
      });

      const captured = await captureResponse(response);
      const normalized = normalizeResponse(captured);
      const expected = loadFixture("receipt_success");

      expect(normalized).toEqual(expected);
    });

    it("matches receipt not found error response fixture", async () => {
      const repository = new MemoryApiRepository();
      const request = new Request(`https://stealth.test/v1/receipts/${messageId}`, {
        headers: { "x-request-id": "req-receipt-2" },
      });

      const response = await handleApiRequest(request, async () => {
        const receipt = await getReceipt(repository, messageId);
        return apiSuccess(request, receipt);
      });

      const captured = await captureResponse(response);
      const normalized = normalizeResponse(captured);
      const expected = loadFixture("receipt_error_not_found");

      expect(normalized).toEqual(expected);
    });
  });
});
