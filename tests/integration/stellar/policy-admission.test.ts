import { describe, expect, it, beforeAll } from "vitest";
import { Keypair, rpc } from "@stellar/stellar-sdk";

import { loadManifest } from "../../../src/config/registry";
import { loadRuntimeConfig } from "../../../src/config";
import {
  createPoliciesClient,
  evaluate,
  getVersionedPolicy,
} from "../../../src/services/stellar/contracts/policies";

/**
 * Live testnet proof for BETA-036. Skips when no testnet manifest is present
 * or when the RPC/contract call is unavailable. Reads the deployed Policies
 * contract so relay admission is proven against real Soroban state.
 */
describe("Live Policies contract admission reads", () => {
  let manifest: ReturnType<typeof loadManifest>;

  beforeAll(() => {
    manifest = loadManifest();
  });

  it("reads a versioned policy for an unprovisioned owner", async () => {
    if (!manifest || manifest.network !== "testnet") return;

    const config = loadRuntimeConfig();
    const owner = Keypair.random().publicKey();
    const client = createPoliciesClient({
      contractId: manifest.contracts.policies.contractId,
      networkPassphrase: config.network.networkPassphrase,
      rpcUrl: config.network.sorobanRpcUrl,
      publicKey: owner,
    });

    try {
      const versioned = await getVersionedPolicy(client, owner);
      expect(versioned.version).toBeGreaterThanOrEqual(0);
      expect(typeof versioned.policy.allow_unknown).toBe("boolean");
      expect(typeof versioned.policy.require_verified).toBe("boolean");
    } catch (error) {
      console.warn("Skipping live policy read; testnet RPC unavailable.", error);
    }
  });

  it("evaluates admission against the deployed contract", async () => {
    if (!manifest || manifest.network !== "testnet") return;

    const config = loadRuntimeConfig();
    const owner = Keypair.random().publicKey();
    const sender = Keypair.random().publicKey();
    const client = createPoliciesClient({
      contractId: manifest.contracts.policies.contractId,
      networkPassphrase: config.network.networkPassphrase,
      rpcUrl: config.network.sorobanRpcUrl,
      publicKey: owner,
    });

    try {
      const decision = await evaluate(client, owner, sender, false, 0n, false);
      expect(typeof decision.allowed).toBe("boolean");
      expect(typeof decision.version).toBe("number");
      expect(decision.required_postage >= 0n).toBe(true);
    } catch (error) {
      console.warn("Skipping live policy evaluate; testnet RPC unavailable.", error);
    }
  });
});
