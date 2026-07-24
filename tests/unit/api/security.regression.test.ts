import { describe, expect, it, beforeEach } from "vitest";
import { Route as PolicyRoute } from "../../../src/routes/api/v1/policies/$owner";
import { ACTOR_HEADER } from "../../../src/server/api/actor";
import { getApiContext } from "../../../src/server/api/context";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";

const owner = `G${"A".repeat(55)}`;
const attacker = `G${"B".repeat(55)}`;

const updatePolicyHandler = (PolicyRoute.options as any).server?.handlers?.PUT;

function updatePolicyRequest(actor?: string, headers: Record<string, string> = {}) {
  const reqHeaders: Record<string, string> = {
    "content-type": "application/json",
    ...headers,
  };
  if (actor !== undefined) {
    reqHeaders[ACTOR_HEADER] = actor;
  }

  return new Request(`https://stealth.test/api/v1/policies/${owner}`, {
    method: "PUT",
    headers: reqHeaders,
    body: JSON.stringify({
      allowUnknown: true,
      minimumPostage: "500",
      requireVerified: false,
    }),
  });
}

describe("API Security Regressions (#1555)", () => {
  let repo: MemoryApiRepository;

  beforeEach(async () => {
    repo = (await getApiContext()).repository as MemoryApiRepository;
    repo.reset();
  });

  describe("Authentication & Authorization Bypasses", () => {
    it.fails("forged actor headers fail", async () => {
      // Attacker attempts to forge the actor header to act as the owner
      const response = await updatePolicyHandler({
        request: updatePolicyRequest(owner),
        params: { owner },
      });
      // The current model trusts the header, but a signed model will reject this.
      // This test is expected to fail (return 200) until the security fix is implemented.
      expect(response.status).not.toBe(200);
    });

    it.fails("replayed signatures fail", async () => {
      const validHeaders = {
        [ACTOR_HEADER]: owner,
        "x-stealth-nonce": "nonce123",
        "x-stealth-timestamp": new Date().toISOString(),
        "x-stealth-signature": "sig123",
      };

      const firstResponse = await updatePolicyHandler({
        request: updatePolicyRequest(owner, validHeaders),
        params: { owner },
      });
      expect(firstResponse.status).toBe(200);

      // Replay the exact same request
      const secondResponse = await updatePolicyHandler({
        request: updatePolicyRequest(owner, validHeaders),
        params: { owner },
      });
      // Second response should be rejected as replay
      expect(secondResponse.status).not.toBe(200);
    });

    it.fails("signatures cannot move across routes or bodies", async () => {
      // Attacker takes a valid signature for one route/body and uses it for another
      const validHeaders = {
        [ACTOR_HEADER]: owner,
        "x-stealth-nonce": "nonce456",
        "x-stealth-timestamp": new Date().toISOString(),
        "x-stealth-signature": "sig_for_different_request",
      };

      const response = await updatePolicyHandler({
        request: updatePolicyRequest(owner, validHeaders),
        params: { owner },
      });
      // Should fail since the signature doesn't match the route/body
      expect(response.status).not.toBe(200);
    });

    it("non-owners cannot mutate protected resources", async () => {
      const response = await updatePolicyHandler({
        request: updatePolicyRequest(attacker),
        params: { owner },
      });

      expect(response.status).toBe(403);
    });
  });
});
