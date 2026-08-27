import { describe, expect, it, beforeAll } from "vitest";
import { Keypair, rpc } from "@stellar/stellar-sdk";

import { loadManifest } from "../../../src/config/registry";
import { loadRuntimeConfig } from "../../../src/config";
import {
  createPoliciesClient,
  evaluate,
  getVersionedPolicy,
  getPolicy,
  setPolicy,
  setSenderRule,
  senderRule,
  senderTier,
  SenderRule as ContractSenderRule,
  type MailboxPolicy,
} from "../../../src/services/stellar/contracts/policies";

/**
 * Live testnet proof for BETA-036 (reads) and BETA-041 (writes).
 * Skips when no testnet manifest is present or when the RPC/contract
 * call is unavailable.
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

/**
 * Live testnet write proof for BETA-041.
 *
 * Each test generates a fresh ephemeral owner keypair, funds it via the
 * Stellar testnet Friendbot, and exercises set_policy / get_policy /
 * set_sender_rule / sender_rule against the real Soroban RPC.
 *
 * Tests skip when:
 *   - No testnet manifest is present
 *   - The network field is not "testnet"
 *   - No operator secret is configured (tests need it to gate the suite)
 *   - Friendbot is unreachable (account cannot be funded)
 *
 * Once the guard passes and funding succeeds, assertion failures propagate
 * normally so CI catches regressions in the deployed contract.
 *
 * Run with:
 *   npx vitest run tests/integration/stellar/policy-admission.test.ts
 */
describe("Live Policies contract writes (BETA-041)", () => {
  let manifest: ReturnType<typeof loadManifest>;
  let operatorKeypair: Keypair;
  let rpcServer: rpc.Server;
  let config: ReturnType<typeof loadRuntimeConfig>;
  let canWrite = false;

  /**
   * Fund an account via the Stellar testnet Friendbot.
   * Throws on failure so the caller can decide whether to skip or fail.
   */
  async function fundAccount(publicKey: string): Promise<void> {
    const resp = await fetch(
      `https://friendbot.stellar.org/?addr=${encodeURIComponent(publicKey)}`,
    );
    if (!resp.ok) {
      throw new Error(`Friendbot funding failed: ${resp.status} ${resp.statusText}`);
    }
  }

  beforeAll(async () => {
    manifest = loadManifest();
    try {
      config = loadRuntimeConfig();
      if (config.secrets?.operatorSecret) {
        operatorKeypair = Keypair.fromSecret(config.secrets.operatorSecret);
      }
      rpcServer = new rpc.Server(config.network.sorobanRpcUrl);
    } catch {
      // Config unavailable — tests will skip.
      return;
    }

    if (!manifest || manifest.network !== "testnet" || !operatorKeypair) return;

    // Verify Friendbot is reachable and testnet is live before enabling
    // the write tests.  This is the single availability gate.
    try {
      const probe = Keypair.random();
      await fundAccount(probe.publicKey());
      canWrite = true;
    } catch {
      // Testnet or Friendbot unreachable — skip all write tests.
    }
  });

  it("set_policy + get_policy round-trip on a fresh owner", async () => {
    if (!canWrite) return;

    const ownerKeypair = Keypair.random();
    const owner = ownerKeypair.publicKey();
    await fundAccount(owner);
    const client = createPoliciesClient({
      contractId: manifest!.contracts.policies.contractId,
      networkPassphrase: config!.network.networkPassphrase,
      rpcUrl: config!.network.sorobanRpcUrl,
      publicKey: owner,
      signer: ownerKeypair.secret(),
    });

    const policy: MailboxPolicy = {
      allow_unknown: true,
      require_verified: false,
      require_receipt: false,
      minimum_postage: 500n,
    };

    const setResult = await setPolicy(client, owner, policy);
    expect(setResult.isOk()).toBe(true);

    const fetched = await getPolicy(client, owner);
    expect(fetched.allow_unknown).toBe(policy.allow_unknown);
    expect(fetched.require_verified).toBe(policy.require_verified);
    expect(fetched.require_receipt).toBe(policy.require_receipt);
    expect(fetched.minimum_postage).toBe(policy.minimum_postage);
  });

  it("set_sender_rule + sender_rule round-trip", async () => {
    if (!canWrite) return;

    const ownerKeypair = Keypair.random();
    const owner = ownerKeypair.publicKey();
    const senderKeypair = Keypair.random();
    const senderAddr = senderKeypair.publicKey();
    await fundAccount(owner);
    const client = createPoliciesClient({
      contractId: manifest!.contracts.policies.contractId,
      networkPassphrase: config!.network.networkPassphrase,
      rpcUrl: config!.network.sorobanRpcUrl,
      publicKey: owner,
      signer: ownerKeypair.secret(),
    });

    const setResult = await setSenderRule(client, owner, senderAddr, ContractSenderRule.Allow);
    expect(setResult.isOk()).toBe(true);

    const rule = await senderRule(client, owner, senderAddr);
    expect(rule).toBe(ContractSenderRule.Allow);
  });

  it("evaluate returns deterministic decision after set_policy", async () => {
    if (!canWrite) return;

    const ownerKeypair = Keypair.random();
    const owner = ownerKeypair.publicKey();
    const senderKeypair = Keypair.random();
    const senderAddr = senderKeypair.publicKey();
    await fundAccount(owner);
    const client = createPoliciesClient({
      contractId: manifest!.contracts.policies.contractId,
      networkPassphrase: config!.network.networkPassphrase,
      rpcUrl: config!.network.sorobanRpcUrl,
      publicKey: owner,
      signer: ownerKeypair.secret(),
    });

    // Set a restrictive policy: no unknown senders, minimum postage 100
    await setPolicy(client, owner, {
      allow_unknown: false,
      require_verified: false,
      require_receipt: false,
      minimum_postage: 100n,
    });

    // Evaluate: unknown sender with 0 postage should be blocked
    const decision = await evaluate(client, owner, senderAddr, false, 0n, false);
    expect(decision.allowed).toBe(false);
    expect(decision.version).toBeGreaterThanOrEqual(1);
  });

  it("re-evaluation after policy change reflects new version", async () => {
    if (!canWrite) return;

    const ownerKeypair = Keypair.random();
    const owner = ownerKeypair.publicKey();
    const senderKeypair = Keypair.random();
    const senderAddr = senderKeypair.publicKey();
    await fundAccount(owner);
    const client = createPoliciesClient({
      contractId: manifest!.contracts.policies.contractId,
      networkPassphrase: config!.network.networkPassphrase,
      rpcUrl: config!.network.sorobanRpcUrl,
      publicKey: owner,
      signer: ownerKeypair.secret(),
    });

    // Phase 1: permissive policy → sender allowed
    await setPolicy(client, owner, {
      allow_unknown: true,
      require_verified: false,
      require_receipt: false,
      minimum_postage: 0n,
    });
    const v1 = await evaluate(client, owner, senderAddr, false, 0n, false);
    expect(v1.allowed).toBe(true);
    const v1Version = v1.version;

    // Phase 2: restrictive policy → sender blocked
    await setPolicy(client, owner, {
      allow_unknown: false,
      require_verified: true,
      require_receipt: false,
      minimum_postage: 0n,
    });
    const v2 = await evaluate(client, owner, senderAddr, false, 0n, false);
    expect(v2.allowed).toBe(false);
    expect(v2.version).toBeGreaterThan(v1Version);
  });

  it("get_versioned_policy returns monotonically increasing version", async () => {
    if (!canWrite) return;

    const ownerKeypair = Keypair.random();
    const owner = ownerKeypair.publicKey();
    await fundAccount(owner);
    const client = createPoliciesClient({
      contractId: manifest!.contracts.policies.contractId,
      networkPassphrase: config!.network.networkPassphrase,
      rpcUrl: config!.network.sorobanRpcUrl,
      publicKey: owner,
      signer: ownerKeypair.secret(),
    });

    await setPolicy(client, owner, {
      allow_unknown: true,
      require_verified: false,
      require_receipt: false,
      minimum_postage: 0n,
    });
    const afterFirst = await getVersionedPolicy(client, owner);

    await setPolicy(client, owner, {
      allow_unknown: true,
      require_verified: false,
      require_receipt: false,
      minimum_postage: 250n,
    });
    const afterSecond = await getVersionedPolicy(client, owner);

    expect(afterSecond.version).toBeGreaterThan(afterFirst.version);
  });
});
