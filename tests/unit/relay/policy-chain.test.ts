import { describe, expect, it } from "vitest";
import { PolicyReason, SenderRule } from "../../../src/services/stellar/contracts/policies";
import {
  createLivePolicyChainClient,
  isLivePoliciesContractId,
} from "../../../src/services/relay/policy-chain";

const owner = `G${"A".repeat(55)}`;
const sender = `G${"B".repeat(55)}`;

describe("createLivePolicyChainClient", () => {
  it("maps contract evaluate results onto admission evidence fields", async () => {
    const evaluateFn = async () => ({
      allowed: false,
      reason: PolicyReason.SenderBlocked,
      required_postage: 100n,
      rule: SenderRule.Block,
      version: 7,
    });

    const client = createLivePolicyChainClient({
      contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
      networkPassphrase: "Test SDF Network ; September 2015",
      rpcUrl: "https://soroban-testnet.stellar.org",
      evaluateFn: evaluateFn as never,
    });

    await expect(
      client.evaluate({ owner, sender, postage: "0", verified: true, receipt: false }),
    ).resolves.toEqual({
      allowed: false,
      reason: "sender_blocked",
      requiredPostage: "100",
      rule: "block",
      version: 7,
    });
  });

  it("rejects an unknown contract reason as malformed chain output", async () => {
    const client = createLivePolicyChainClient({
      contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
      networkPassphrase: "Test SDF Network ; September 2015",
      rpcUrl: "https://soroban-testnet.stellar.org",
      evaluateFn: (async () => ({
        allowed: true,
        reason: 99 as PolicyReason,
        required_postage: 0n,
        rule: SenderRule.Default,
        version: 1,
      })) as never,
    });

    await expect(
      client.evaluate({ owner, sender, postage: "0", verified: true, receipt: false }),
    ).rejects.toThrow(/malformed_chain_reason/);
  });

  it("maps all valid PolicyReason variants to PolicyReasonCode", async () => {
    const reasonMap: Array<[PolicyReason, string]> = [
      [PolicyReason.SenderAllowed, "sender_allowed"],
      [PolicyReason.SenderBlocked, "sender_blocked"],
      [PolicyReason.UnknownSendersDisabled, "unknown_senders_disabled"],
      [PolicyReason.VerificationRequired, "verification_required"],
      [PolicyReason.ReceiptRequired, "receipt_required"],
      [PolicyReason.InsufficientPostage, "insufficient_postage"],
      [PolicyReason.PolicySatisfied, "policy_satisfied"],
      [PolicyReason.TierSatisfied, "tier_satisfied"],
    ];

    for (const [reason, expectedCode] of reasonMap) {
      const client = createLivePolicyChainClient({
        contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
        networkPassphrase: "Test SDF Network ; September 2015",
        rpcUrl: "https://soroban-testnet.stellar.org",
        evaluateFn: (async () => ({
          allowed: true,
          reason,
          required_postage: 0n,
          rule: SenderRule.Default,
          version: 1,
        })) as never,
      });

      const result = await client.evaluate({
        owner,
        sender,
        postage: "0",
        verified: true,
        receipt: false,
      });
      expect(result.reason).toBe(expectedCode);
    }
  });

  it("maps all valid SenderRule contract variants to domain SenderRule", async () => {
    const ruleMap: Array<[SenderRule, string]> = [
      [SenderRule.Default, "default"],
      [SenderRule.Allow, "allow"],
      [SenderRule.Block, "block"],
    ];

    for (const [rule, expectedRule] of ruleMap) {
      const client = createLivePolicyChainClient({
        contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
        networkPassphrase: "Test SDF Network ; September 2015",
        rpcUrl: "https://soroban-testnet.stellar.org",
        evaluateFn: (async () => ({
          allowed: true,
          reason: PolicyReason.PolicySatisfied,
          required_postage: 0n,
          rule,
          version: 1,
        })) as never,
      });

      const result = await client.evaluate({
        owner,
        sender,
        postage: "0",
        verified: true,
        receipt: false,
      });
      expect(result.rule).toBe(expectedRule);
    }
  });

  it("handles zero-version policy decisions", async () => {
    const client = createLivePolicyChainClient({
      contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
      networkPassphrase: "Test SDF Network ; September 2015",
      rpcUrl: "https://soroban-testnet.stellar.org",
      evaluateFn: (async () => ({
        allowed: false,
        reason: PolicyReason.UnknownSendersDisabled,
        required_postage: 0n,
        rule: SenderRule.Default,
        version: 0,
      })) as never,
    });

    const result = await client.evaluate({
      owner,
      sender,
      postage: "0",
      verified: false,
      receipt: false,
    });
    expect(result.version).toBe(0);
    expect(result.allowed).toBe(false);
  });

  it("handles large required_postage values", async () => {
    const client = createLivePolicyChainClient({
      contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
      networkPassphrase: "Test SDF Network ; September 2015",
      rpcUrl: "https://soroban-testnet.stellar.org",
      evaluateFn: (async () => ({
        allowed: false,
        reason: PolicyReason.InsufficientPostage,
        required_postage: 9999999999n,
        rule: SenderRule.Default,
        version: 1,
      })) as never,
    });

    const result = await client.evaluate({
      owner,
      sender,
      postage: "0",
      verified: true,
      receipt: false,
    });
    expect(result.requiredPostage).toBe("9999999999");
  });
});
