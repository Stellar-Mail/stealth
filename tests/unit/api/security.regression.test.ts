import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";

import { Route as PolicyRoute } from "../../../src/routes/api/v1/policies/$owner";
import { ACTOR_HEADER } from "../../../src/server/api/actor";
import { getApiContext } from "../../../src/server/api/context";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import {
  buildSignedRequestHeaders,
  resetSignedRequestNonceStore,
  SIGNATURE_HEADER,
} from "../../../src/server/api/auth/signed-request-verify";

const updatePolicyHandler = (PolicyRoute.options as any).server?.handlers?.PUT;

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

describe("API Security Regressions (#1555)", () => {
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
      expect(firstResponse.status).toBe(200);

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

    it("non-owners cannot mutate protected resources", async () => {
      const response = await updatePolicyHandler({
        request: updatePolicyRequest(attackerKeypair),
        params: { owner },
      });

      expect(response.status).toBe(403);
    });
  });
});
