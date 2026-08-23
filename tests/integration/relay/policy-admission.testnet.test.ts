/**
 * Live testnet probe for relay policy admission (Issue #1943 BETA-036).
 *
 * Skips unless a signed testnet contract-manifest.json is present. This is
 * not part of `npm test` (vitest include is tests/unit); run with:
 *   npx vitest run tests/integration/relay/policy-admission.testnet.test.ts
 */
import { describe, expect, it, beforeAll } from "vitest";
import { rpc, Contract } from "@stellar/stellar-sdk";
import { loadManifest } from "../../../src/config/registry";
import { isLivePoliciesContractId } from "../../../src/services/relay/policy-chain";

describe("Live testnet Policies contract (relay admission)", () => {
  let manifest: ReturnType<typeof loadManifest>;
  let server: rpc.Server | undefined;

  beforeAll(() => {
    manifest = loadManifest();
    if (!manifest || manifest.network !== "testnet") {
      return;
    }
    server = new rpc.Server("https://soroban-rpc.testnet.stellar.org");
  });

  it("has a live Policies contract id in the deployed manifest", async () => {
    if (!manifest || !server) return;

    const policiesId = manifest.contracts.policies?.contractId;
    expect(policiesId).toBeDefined();
    expect(isLivePoliciesContractId(policiesId)).toBe(true);

    const contract = new Contract(policiesId);
    const ledgerEntry = await server.getLedgerEntries(contract.getFootprint());
    expect(ledgerEntry).toBeDefined();
    expect(ledgerEntry.entries.length).toBeGreaterThan(0);
  });
});
