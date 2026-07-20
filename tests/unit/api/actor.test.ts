import { Keypair } from "@stellar/stellar-sdk";
import { beforeEach, describe, expect, it } from "vitest";

import {
  ACTOR_HEADER,
  assertActorMatches,
  requireActor,
  resetActorReplayCache,
} from "../../../src/server/api/actor";
import { createSignedRequest } from "./signed-request";

describe("API actor guard", () => {
  beforeEach(resetActorReplayCache);

  it("requires all signed actor headers", async () => {
    const signer = Keypair.random();
    const request = new Request("https://stealth.test/api", {
      headers: { [ACTOR_HEADER]: signer.publicKey() },
    });

    await expect(requireActor(request)).rejects.toMatchObject({ status: 401 });
  });

  it("returns the principal from a valid signed request", async () => {
    const signer = Keypair.random();
    const request = await createSignedRequest(signer, "https://stealth.test/api");

    await expect(requireActor(request)).resolves.toBe(signer.publicKey());
  });

  it("rejects a principal that does not own the resource", () => {
    expect(() =>
      assertActorMatches(Keypair.random().publicKey(), Keypair.random().publicKey()),
    ).toThrowError(expect.objectContaining({ status: 403 }));
  });
});
