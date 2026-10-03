import { Buffer } from "node:buffer";
import { Keypair } from "@stellar/stellar-sdk";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Route } from "@/routes/api/v1/envelopes/authorize";
import { getApiContext } from "@/server/api/context";
import { MemoryApiRepository } from "@/server/api/memory-repository";
import { canonicalizePayload } from "@/services/crypto/envelope";
import { encryptWalletSecret } from "@/services/stellar/wallet-secret-crypto";

const handlers = (Route.options as any).server.handlers;
const keypair = Keypair.random();
const sender = keypair.publicKey();
const userId = "usr_account_stamp";
const sessionId = "sess_account_stamp";
const url = "http://localhost:8080/api/v1/envelopes/authorize";

function canonicalEnvelope(address = sender) {
  return canonicalizePayload({
    version: "v1",
    sender: address,
    recipient: Keypair.random().publicKey(),
    timestamp: new Date().toISOString(),
    encryption_metadata: { algorithm: "AES-256-GCM", nonce: "a".repeat(24), mac: "b".repeat(32) },
    content_commitment: `v1:sha256:hex:${"c".repeat(64)}`,
    attachments: [],
    request_nonce: "d".repeat(32),
    audience: "relay:stealth.test",
    idempotency_key: "mail-stamp-test",
    replay_window_seconds: 300,
  });
}

function request(method: string, canonical?: string, cookie = `stealth_session=${sessionId}`) {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json", Origin: "http://localhost:8080", cookie },
    ...(canonical === undefined ? {} : { body: JSON.stringify({ canonical }) }),
  });
}

describe("Account mail stamping", () => {
  let repository: MemoryApiRepository;

  beforeEach(async () => {
    repository = (await getApiContext()).repository as MemoryApiRepository;
    repository.reset();
    const now = new Date().toISOString();
    await repository.createUser({
      userId,
      address: sender,
      email: "stamp@betasmail.com",
      username: "stamp",
      status: "active",
      createdAt: now,
      updatedAt: now,
      version: 1,
    });
    await repository.createSession({
      sessionId,
      userId,
      createdAt: now,
      lastActiveAt: now,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    await repository.setManagedWallet({
      userId,
      address: sender,
      network: "testnet",
      fundingStatus: "funded",
      encryptedSecret: await encryptWalletSecret(keypair.secret(), "dev-storage-secret-change-me"),
      fundedAt: now,
      createdAt: now,
      updatedAt: now,
      lastError: null,
    });
  });

  afterEach(() => repository.reset());

  it("signs a canonical relay envelope using only a session cookie", async () => {
    const canonical = canonicalEnvelope();
    const response = await handlers.POST({ request: request("POST", canonical) });
    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(data).toEqual({ scheme: "Ed25519", signerAddress: sender, value: expect.any(String) });
    expect(keypair.verify(Buffer.from(canonical), Buffer.from(data.value, "hex"))).toBe(true);
    const body = JSON.stringify(data);
    expect(body).not.toContain(keypair.secret());
    expect(body).not.toContain("encryptedSecret");
  });

  it("returns only the public signing address on GET", async () => {
    const response = await handlers.GET({ request: request("GET") });
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ signerAddress: sender });
  });

  it("requires a session and never trusts an address header", async () => {
    const unsigned = request("POST", canonicalEnvelope(), "");
    unsigned.headers.set("x-stealth-address", sender);
    expect((await handlers.POST({ request: unsigned })).status).toBe(401);
  });

  it("rejects expired sessions", async () => {
    const session = (await repository.getSession(sessionId))!;
    await repository.updateSession({ ...session, expiresAt: new Date(0).toISOString() });
    expect((await handlers.POST({ request: request("POST", canonicalEnvelope()) })).status).toBe(
      401,
    );
  });

  it("rejects a different sender even with a valid session", async () => {
    const response = await handlers.POST({
      request: request("POST", canonicalEnvelope(Keypair.random().publicKey())),
    });
    expect(response.status).toBe(403);
  });

  it("rejects arbitrary messages and noncanonical JSON", async () => {
    expect(
      (await handlers.POST({ request: request("POST", "sign this transaction") })).status,
    ).toBe(400);
    const noncanonical = JSON.stringify(JSON.parse(canonicalEnvelope()), null, 2);
    expect((await handlers.POST({ request: request("POST", noncanonical) })).status).toBe(400);
  });

  it("fails closed when encrypted key material does not match the account", async () => {
    const wallet = (await repository.getManagedWallet(userId))!;
    await repository.setManagedWallet({
      ...wallet,
      encryptedSecret: await encryptWalletSecret(
        Keypair.random().secret(),
        "dev-storage-secret-change-me",
      ),
    });
    const response = await handlers.POST({ request: request("POST", canonicalEnvelope()) });
    expect(response.status).toBe(409);
    expect(JSON.stringify(await response.json())).not.toContain("ciphertext");
  });
});
