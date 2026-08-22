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

  it("accepts a mixed checksum-bearing contract id shape", () => {
    expect(
      isLivePoliciesContractId("CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4"),
    ).toBe(true);
  });

  it("rejects placeholders and repeated-letter development ids", () => {
    expect(isLivePoliciesContractId(undefined)).toBe(false);
    expect(isLivePoliciesContractId("placeholder")).toBe(false);
    expect(isLivePoliciesContractId("C".repeat(56))).toBe(false);
    expect(
      isLivePoliciesContractId("CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"),
    ).toBe(false);
    expect(isLivePoliciesContractId("not-a-contract")).toBe(false);
  });
});
