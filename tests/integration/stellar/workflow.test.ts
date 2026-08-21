import { describe, it, expect, beforeAll } from "vitest";
import { Keypair, rpc, Contract } from "@stellar/stellar-sdk";
import { loadManifest } from "../../../src/config/registry";

describe("Live Testnet Workflow", () => {
  let manifest: any;
  let server: rpc.Server;

  beforeAll(() => {
    // This test relies on a successfully deployed manifest on testnet
    manifest = loadManifest();

    // Skip tests if no manifest or if it's not testnet (we don't want to run this against mainnet accidentally)
    if (!manifest || manifest.network !== "testnet") {
      console.warn("Skipping Live Testnet Workflow tests: No testnet manifest found.");
      return;
    }

    server = new rpc.Server("https://soroban-testnet.stellar.org");
  });

  it("can read policies contract", async () => {
    if (!manifest) return;

    const policiesId = manifest.contracts.policies.contractId;
    expect(policiesId).toBeDefined();

    const contract = new Contract(policiesId);
    const ledgerEntry = await server.getLedgerEntries(contract.getFootprint());

    expect(ledgerEntry).toBeDefined();
    expect(ledgerEntry.entries.length).toBeGreaterThan(0);
  });

  it("can read postage contract", async () => {
    if (!manifest) return;

    const postageId = manifest.contracts.postage.contractId;
    expect(postageId).toBeDefined();

    const contract = new Contract(postageId);
    const ledgerEntry = await server.getLedgerEntries(contract.getFootprint());

    expect(ledgerEntry).toBeDefined();
    expect(ledgerEntry.entries.length).toBeGreaterThan(0);
  });

  it("can read receipts contract", async () => {
    if (!manifest) return;

    const receiptsId = manifest.contracts.receipts.contractId;
    expect(receiptsId).toBeDefined();

    const contract = new Contract(receiptsId);
    const ledgerEntry = await server.getLedgerEntries(contract.getFootprint());

    expect(ledgerEntry).toBeDefined();
    expect(ledgerEntry.entries.length).toBeGreaterThan(0);
  });

  it("can read lifecycle contract", async () => {
    if (!manifest) return;

    const lifecycleId = manifest.contracts.lifecycle.contractId;
    expect(lifecycleId).toBeDefined();

    const contract = new Contract(lifecycleId);
    const ledgerEntry = await server.getLedgerEntries(contract.getFootprint());

    expect(ledgerEntry).toBeDefined();
    expect(ledgerEntry.entries.length).toBeGreaterThan(0);
  });

  // Further integration tests would perform actual transactions using funded testnet accounts.
  // We leave those out of the basic verification test to avoid requiring hardcoded secrets in CI,
  // but they can be run manually by providing a testnet secret in the environment.
});

// ---------------------------------------------------------------------------
// Integration tests: relay ↔ crypto service boundaries (no network required)
// ---------------------------------------------------------------------------

import { sealEnvelope } from "../../../src/services/crypto/envelope";
import {
  openEnvelope,
  OpenEnvelopeError,
  WrappedKeyProvider,
} from "../../../src/services/crypto/open-envelope";
import { generateRecipientKeyPair } from "../../../src/services/crypto/key-wrap";
import { RelayService, type RelayServiceConfig } from "../../../src/services/relay/relay-service";
import { MemoryRelayPersistence } from "../../../src/services/relay/memory-persistence";
import { InProcessRelayWorker } from "../../../src/services/relay/in-process-worker";
import { submitToRelay, type RelayTransport } from "../../../src/services/relay/submit";
import type { RelayNode } from "../../../src/services/relay/federation";

const ALICE_ADDR = `G${"A".repeat(55)}`;
const BOB_ADDR = `G${"B".repeat(55)}`;

function freshId(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

function makeRelayService() {
  const persistence = new MemoryRelayPersistence();
  const worker = new InProcessRelayWorker(persistence);
  const config: RelayServiceConfig = {
    serviceName: "stealth-relay-integration",
    version: "test",
    apiVersion: "v1",
    protocolVersion: "v1",
    timeoutMs: 500,
    network: {
      horizonUrl: "https://horizon-testnet.stellar.org",
      sorobanRpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015",
    },
  };
  return { persistence, service: new RelayService(persistence, worker, config) };
}

describe("Integration: relay ↔ MemoryRelayPersistence round-trip", () => {
  it("enqueued message is retrieved intact from Bob's queue", async () => {
    const { service } = makeRelayService();
    const messageId = freshId();
    const payload = JSON.stringify({ payload: { version: "v1" }, ciphertext: "abc" });

    await service.submit({
      messageId,
      sender: ALICE_ADDR,
      recipient: BOB_ADDR,
      recipientDomain: "stealth.test",
      payload,
    });

    const queue = await service.getRecipientQueue(BOB_ADDR);
    expect(queue).toHaveLength(1);
    expect(queue[0].messageId).toBe(messageId);
    expect(queue[0].sender).toBe(ALICE_ADDR);
    expect(queue[0].recipient).toBe(BOB_ADDR);
    expect(queue[0].payload).toBe(payload);
  });

  it("queue is empty before any submission (no seeded data)", async () => {
    const { service } = makeRelayService();
    const queue = await service.getRecipientQueue(BOB_ADDR);
    expect(queue).toHaveLength(0);
  });

  it("relay submission is idempotent: 409 response yields DEDUPLICATED state", async () => {
    const relayNode: RelayNode = {
      domain: "stealth.test",
      endpoint: "/api/v1/relay/messages",
      publicKey: "",
    };
    let callCount = 0;
    const transport: RelayTransport = async () => {
      callCount += 1;
      return callCount === 1 ? { status: 200 } : { status: 409 };
    };
    const base = {
      messageId: freshId(),
      sender: ALICE_ADDR,
      recipient: BOB_ADDR,
      recipientDomain: "stealth.test",
      payload: "p",
    };
    const first = await submitToRelay(base, { resolveRelay: async () => relayNode, transport });
    const second = await submitToRelay(base, { resolveRelay: async () => relayNode, transport });

    expect(first.state).toBe("ACKNOWLEDGED");
    expect(second.state).toBe("DEDUPLICATED");
    expect(second.delivered).toBe(true);
  });
});

describe("Integration: sealEnvelope → openEnvelope round-trip", () => {
  it("Bob decrypts his own message with the correct key", async () => {
    const bobKp = await generateRecipientKeyPair();
    const plaintext = "Integration test body — ✓";

    const sealed = await sealEnvelope({
      sender: ALICE_ADDR,
      recipient: BOB_ADDR,
      body: plaintext,
      recipientPublicKeys: [bobKp.publicKeySpkiBase64],
    });

    const provider = new WrappedKeyProvider(bobKp.privateKeyPkcs8Base64);
    const opened = await openEnvelope(
      { payload: sealed.payload, ciphertext: sealed.ciphertext },
      provider,
    );

    expect(opened.body).toBe(plaintext);
    expect(opened.sender).toBe(ALICE_ADDR);
    expect(opened.recipient).toBe(BOB_ADDR);
  });

  it("Alice cannot decrypt Bob-bound ciphertext (wrong private key → OpenEnvelopeError)", async () => {
    const aliceKp = await generateRecipientKeyPair();
    const bobKp = await generateRecipientKeyPair();

    const sealed = await sealEnvelope({
      sender: ALICE_ADDR,
      recipient: BOB_ADDR,
      body: "only Bob can read this",
      recipientPublicKeys: [bobKp.publicKeySpkiBase64],
    });

    const aliceProvider = new WrappedKeyProvider(aliceKp.privateKeyPkcs8Base64);
    await expect(
      openEnvelope({ payload: sealed.payload, ciphertext: sealed.ciphertext }, aliceProvider),
    ).rejects.toBeInstanceOf(OpenEnvelopeError);
  });

  it("full relay pipeline: seal → enqueue → dequeue → decrypt", async () => {
    const bobKp = await generateRecipientKeyPair();
    const { service } = makeRelayService();
    const messageId = freshId();
    const plaintext = "full relay pipeline integration test";

    // Seal
    const sealed = await sealEnvelope({
      sender: ALICE_ADDR,
      recipient: BOB_ADDR,
      body: plaintext,
      recipientPublicKeys: [bobKp.publicKeySpkiBase64],
    });
    const payloadStr = JSON.stringify({ payload: sealed.payload, ciphertext: sealed.ciphertext });

    // Enqueue via RelayService
    await service.submit({
      messageId,
      sender: ALICE_ADDR,
      recipient: BOB_ADDR,
      recipientDomain: "stealth.test",
      payload: payloadStr,
    });

    // Dequeue
    const queue = await service.getRecipientQueue(BOB_ADDR);
    expect(queue).toHaveLength(1);
    const envelope = queue[0];

    // Decrypt
    const parsedPayload = JSON.parse(envelope.payload) as { payload: unknown; ciphertext: unknown };
    const provider = new WrappedKeyProvider(bobKp.privateKeyPkcs8Base64);
    const opened = await openEnvelope(parsedPayload, provider);

    expect(opened.body).toBe(plaintext);
  });
});
