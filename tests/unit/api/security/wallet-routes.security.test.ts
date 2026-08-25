/**
 * BETA-084 (Issue #1991) — Wallet route cross-account isolation.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { Route as ManagedWalletRoute } from "@/routes/api/v1/wallet/managed";
import { ACTOR_HEADER } from "@/server/api/actor";
import {
  ALICE_ADDRESS,
  BOB_ADDRESS,
  seedTwoUserIsolationFixture,
} from "../../../fixtures/security-isolation";
import { assertNoSecretsLeaked } from "../../../fixtures/identity";

const managedHandler = (
  ManagedWalletRoute.options as {
    server?: { handlers?: { GET?: (ctx: { request: Request }) => Promise<Response> } };
  }
).server!.handlers!.GET!;

function request(actor: string): Request {
  return new Request("https://stealth.test/api/v1/wallet/managed", {
    method: "GET",
    headers: { [ACTOR_HEADER]: actor },
  });
}

describe("BETA-084 (Issue #1991): Wallet Route Isolation", () => {
  beforeEach(async () => {
    await seedTwoUserIsolationFixture();
  });

  it("returns actor-scoped managed wallet status without secret leakage", async () => {
    const aliceRes = await managedHandler({ request: request(ALICE_ADDRESS) });
    expect(aliceRes.status).toBe(200);
    const aliceBody = await aliceRes.json();
    expect(aliceBody.data.address).toBe(ALICE_ADDRESS);
    assertNoSecretsLeaked(aliceBody);

    const bobRes = await managedHandler({ request: request(BOB_ADDRESS) });
    expect(bobRes.status).toBe(200);
    const bobBody = await bobRes.json();
    expect(bobBody.data.address).toBe(BOB_ADDRESS);
    expect(bobBody.data.address).not.toBe(aliceBody.data.address);
    assertNoSecretsLeaked(bobBody);
  });

  it("denies unauthenticated managed wallet access", async () => {
    const res = await managedHandler({
      request: new Request("https://stealth.test/api/v1/wallet/managed", { method: "GET" }),
    });
    expect(res.status).toBe(401);
  });
});
