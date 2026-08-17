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

    server = new rpc.Server("https://soroban-rpc.testnet.stellar.org");
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
