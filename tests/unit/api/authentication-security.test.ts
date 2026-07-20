import { Keypair } from "@stellar/stellar-sdk";
import { beforeEach, describe, expect, it } from "vitest";

import { Route as PolicyRoute } from "../../../src/routes/api/v1/policies/$owner";
import { resetActorReplayCache } from "../../../src/server/api/actor";
import { getApiContext } from "../../../src/server/api/context";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import { createSignedRequest } from "./signed-request";

const owner = Keypair.random();
const attacker = Keypair.random();
const handler = (PolicyRoute.options as any).server?.handlers?.PUT;
const policy = { allowUnknown: true, minimumPostage: "1000", requireVerified: true };
const replacementPolicy = { ...policy, minimumPostage: "9000" };

function repository() {
  return getApiContext().repository as MemoryApiRepository;
}

function policyUrl(pathOwner = owner.publicKey()) {
  return `https://stealth.test/api/v1/policies/${pathOwner}`;
}

function jsonInit(body = policy): RequestInit {
  return {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

describe("public API authentication regressions", () => {
  beforeEach(() => {
    repository().reset();
    resetActorReplayCache();
  });

  it("rejects a forged actor identity", async () => {
    const request = await createSignedRequest(attacker, policyUrl(), jsonInit(), {
      actor: owner.publicKey(),
    });

    const response = await handler({ request, params: { owner: owner.publicKey() } });

    expect(response.status).toBe(401);
    await expect(repository().getPolicy(owner.publicKey())).resolves.toBeNull();
  });

  it("rejects an exact replay of a valid signature", async () => {
    const request = await createSignedRequest(owner, policyUrl(), jsonInit());
    const replay = request.clone();

    const first = await handler({ request, params: { owner: owner.publicKey() } });
    const second = await handler({ request: replay, params: { owner: owner.publicKey() } });

    expect(first.status).toBe(200);
    expect(second.status).toBe(401);
    await expect(repository().getPolicy(owner.publicKey())).resolves.toEqual(policy);
  });

  it("rejects a signature moved to another route", async () => {
    const signed = await createSignedRequest(owner, policyUrl(), jsonInit());
    const substituted = new Request(`${policyUrl()}/senders/${attacker.publicKey()}`, {
      method: signed.method,
      headers: signed.headers,
      body: await signed.text(),
    });

    const response = await handler({ request: substituted, params: { owner: owner.publicKey() } });

    expect(response.status).toBe(401);
    await expect(repository().getPolicy(owner.publicKey())).resolves.toBeNull();
  });

  it("rejects a signature moved to another body", async () => {
    const signed = await createSignedRequest(owner, policyUrl(), jsonInit());
    const substituted = new Request(policyUrl(), {
      method: signed.method,
      headers: signed.headers,
      body: JSON.stringify(replacementPolicy),
    });

    const response = await handler({ request: substituted, params: { owner: owner.publicKey() } });

    expect(response.status).toBe(401);
    await expect(repository().getPolicy(owner.publicKey())).resolves.toBeNull();
  });

  it("rejects a valid non-owner signature before mutation", async () => {
    const request = await createSignedRequest(attacker, policyUrl(), jsonInit());

    const response = await handler({ request, params: { owner: owner.publicKey() } });

    expect(response.status).toBe(403);
    await expect(repository().getPolicy(owner.publicKey())).resolves.toBeNull();
  });

  it("allows the verified owner to mutate the protected resource", async () => {
    const request = await createSignedRequest(owner, policyUrl(), jsonInit());

    const response = await handler({ request, params: { owner: owner.publicKey() } });

    expect(response.status).toBe(200);
    await expect(repository().getPolicy(owner.publicKey())).resolves.toEqual(policy);
  });
});
