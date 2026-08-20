import { test, expect, ACTOR } from "./fixtures";

const externalWallet = `${ACTOR.slice(0, -2)}WA`;
const otherWallet = `${ACTOR.slice(0, -2)}WB`;
const thirdParty = `${ACTOR.slice(0, -2)}WC`;
const network = "Public Global Stellar Network ; September 2015";
const testnet = "Test SDF Network ; September 2015";

function headers(actor = ACTOR) {
  return { "Content-Type": "application/json", "x-stealth-address": actor };
}

async function createChallenge(page, address, net = network, actor = ACTOR) {
  return page.request.post("/api/v1/wallet/link/challenge", {
    headers: headers(actor),
    data: { address, network: net },
  });
}

async function verifyAndLink(page, address, signature, capabilities, net = network, actor = ACTOR) {
  return page.request.post("/api/v1/wallet/link/verify", {
    headers: headers(actor),
    data: { address, signature, capabilities, network: net },
  });
}

async function listWallets(page, actor = ACTOR) {
  return page.request.get("/api/v1/wallet/link", { headers: headers(actor) });
}

function getUniqueWallet() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let suffix = "";
  for (let i = 0; i < 5; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${ACTOR.slice(0, -5)}${suffix}`;
}

test.describe("wallet link API", () => {
  test("links an external wallet end to end and unlinks it", async ({ page }) => {
    const extWallet = getUniqueWallet();
    const challengeRes = await createChallenge(page, extWallet);
    expect(challengeRes.status()).toBe(200);
    const { data: challengeData } = await challengeRes.json();
    expect(challengeData.challenge).toMatch(/^[a-f0-9]{64}$/);
    expect(challengeData.expiresAt).toBeTruthy();

    const verifyRes = await verifyAndLink(page, extWallet, "d".repeat(64), ["sign"]);
    expect(verifyRes.status()).toBe(200);
    const { data: wallet } = await verifyRes.json();
    expect(wallet.address).toBe(extWallet);
    expect(wallet.capabilities).toEqual(["sign"]);
    expect(wallet.network).toBe(network);
    expect(wallet.linkedAt).toBeTruthy();

    const listRes = await listWallets(page);
    expect(listRes.status()).toBe(200);
    const { data: listData } = await listRes.json();
    expect(listData.wallets.map((w) => w.address)).toContain(extWallet);

    const unlinkRes = await page.request.delete(`/api/v1/wallet/link/${extWallet}`, {
      headers: headers(),
    });
    expect(unlinkRes.status()).toBe(200);
    const { data: unlinkData } = await unlinkRes.json();
    expect(unlinkData.unlinked).toBe(true);
    expect(unlinkData.activeSigner.signerType).toBe("managed");
    expect(unlinkData.activeSigner.isFallback).toBe(true);

    const afterRes = await listWallets(page);
    const { data: afterData } = await afterRes.json();
    expect(afterData.wallets.map((w) => w.address)).not.toContain(extWallet);
  });

  test("rejects unlinking when confirm is explicitly false", async ({ page }) => {
    const extWallet = getUniqueWallet();
    await createChallenge(page, extWallet);
    await verifyAndLink(page, extWallet, "d".repeat(64), ["sign"]);

    const res = await page.request.delete(`/api/v1/wallet/link/${extWallet}?confirm=false`, {
      headers: headers(),
    });
    expect(res.status()).toBe(400);

    // Clean up
    await page.request.delete(`/api/v1/wallet/link/${extWallet}?confirm=true`, {
      headers: headers(),
    });
  });

  test("rejects unauthenticated challenge request", async ({ page }) => {
    const extWallet = getUniqueWallet();
    const res = await page.request.post("/api/v1/wallet/link/challenge", {
      headers: { "Content-Type": "application/json" },
      data: { address: extWallet, network },
    });
    expect(res.status()).toBe(401);
  });

  test("rejects invalid external address", async ({ page }) => {
    const res = await createChallenge(page, "not-a-valid-address");
    expect(res.status()).toBe(422);
  });

  test("rejects duplicate link with 409", async ({ page }) => {
    const extWallet = getUniqueWallet();
    await createChallenge(page, extWallet);
    const first = await verifyAndLink(page, extWallet, "e".repeat(64), ["sign"]);
    expect(first.status()).toBe(200);

    await createChallenge(page, extWallet);
    const second = await verifyAndLink(page, extWallet, "f".repeat(64), ["sign"]);
    expect(second.status()).toBe(409);
  });

  test("rejects duplicate link idempotently across repeats", async ({ page }) => {
    const extWallet = getUniqueWallet();
    await createChallenge(page, extWallet);
    await verifyAndLink(page, extWallet, "a".repeat(64), ["sign"]);

    const repeats: number[] = [];
    for (let i = 0; i < 3; i++) {
      await createChallenge(page, extWallet);
      repeats.push((await verifyAndLink(page, extWallet, `${i}`.repeat(64), ["sign"])).status());
    }
    expect(repeats).toEqual([409, 409, 409]);
  });

  test("rejects verify with no matching challenge", async ({ page }) => {
    const extWallet = getUniqueWallet();
    const res = await verifyAndLink(page, extWallet, "c".repeat(64), ["sign"]);
    expect(res.status()).toBe(400);
  });

  test("rejects wrong network challenge and verify", async ({ page }) => {
    const extWallet = getUniqueWallet();
    const res = await createChallenge(page, extWallet, testnet);
    expect(res.status()).toBe(200);

    const verifyRes = await verifyAndLink(page, extWallet, "b".repeat(64), ["sign"], network);
    expect(verifyRes.status()).toBe(400);
  });

  test("rejects empty capabilities", async ({ page }) => {
    const extWallet = getUniqueWallet();
    await createChallenge(page, extWallet);
    const res = await verifyAndLink(page, extWallet, "9".repeat(64), []);
    expect(res.status()).toBe(422);
  });

  test("unlink on non-existent wallet returns 404", async ({ page }) => {
    const extWallet = getUniqueWallet();
    const res = await page.request.delete(`/api/v1/wallet/link/${extWallet}`, {
      headers: headers(),
    });
    expect(res.status()).toBe(404);
  });
});
