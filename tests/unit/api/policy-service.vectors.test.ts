import { describe, expect, it } from "vitest";

import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import { evaluateMailboxPolicy } from "../../../src/server/api/policy-service";
import type { MailboxPolicy, SenderRule } from "../../../src/server/api/domain";

// Table-driven vectors for every decision branch of evaluateMailboxPolicy.
// Each vector asserts the exact decision, reason code, source, and rule so a regression
// identifies the mismatched branch. Reusable by protocol/integration tests.
export interface PolicyServiceVector {
  name: string;
  policy: MailboxPolicy | null;
  senderRule: SenderRule | null;
  input: { postage: string; sender: string; verified: boolean };
  expected: {
    allowed: boolean;
    reason: string;
    source?: "configured" | "default";
    rule?: SenderRule;
  };
}

const owner = `G${"A".repeat(55)}`;
const sender = `G${"B".repeat(55)}`;
const delegate = `G${"D".repeat(55)}`;

const basePolicy: MailboxPolicy = {
  allowUnknown: false,
  minimumPostage: "0",
  requireVerified: true,
};

export const policyServiceVectors: PolicyServiceVector[] = [
  {
    name: "sender allow override short-circuits (trusted sender)",
    policy: basePolicy,
    senderRule: "allow",
    input: { postage: "0", sender, verified: false },
    expected: { allowed: true, reason: "sender_allowed", rule: "allow" },
  },
  {
    name: "sender block override short-circuits (blocked sender)",
    policy: basePolicy,
    senderRule: "block",
    input: { postage: "0", sender, verified: false },
    expected: { allowed: false, reason: "sender_blocked", rule: "block" },
  },
  {
    name: "unknown sender disabled (allowUnknown=false)",
    policy: { ...basePolicy, allowUnknown: false },
    senderRule: null,
    input: { postage: "0", sender, verified: false },
    expected: { allowed: false, reason: "unknown_senders_disabled", source: "configured", rule: "default" },
  },
  {
    name: "verification required when unverified",
    policy: { ...basePolicy, allowUnknown: true, requireVerified: true },
    senderRule: null,
    input: { postage: "1000", sender, verified: false },
    expected: { allowed: false, reason: "verification_required", source: "configured", rule: "default" },
  },
  {
    name: "insufficient postage below minimum required postage",
    policy: { ...basePolicy, allowUnknown: true, requireVerified: false, minimumPostage: "500" },
    senderRule: null,
    input: { postage: "100", sender, verified: true },
    expected: { allowed: false, reason: "insufficient_postage", source: "configured", rule: "default" },
  },
  {
    name: "policy satisfied (allow, verified, enough postage)",
    policy: { ...basePolicy, allowUnknown: true, requireVerified: true, minimumPostage: "500" },
    senderRule: null,
    input: { postage: "1000", sender, verified: true },
    expected: { allowed: true, reason: "policy_satisfied", source: "configured", rule: "default" },
  },
  {
    name: "missing policy (no stored policy) falls back to default policy (blocks unknown unverified)",
    policy: null,
    senderRule: null,
    input: { postage: "0", sender, verified: false },
    expected: { allowed: false, reason: "unknown_senders_disabled", source: "default", rule: "default" },
  },
  {
    name: "missing policy (no stored policy) allows verified sender with default postage",
    policy: null,
    senderRule: "allow",
    input: { postage: "0", sender, verified: true },
    expected: { allowed: true, reason: "sender_allowed", rule: "allow" },
  },
  {
    name: "delegate sender evaluation with explicit allow rule",
    policy: { ...basePolicy, allowUnknown: true, requireVerified: false, minimumPostage: "0" },
    senderRule: "allow",
    input: { postage: "0", sender: delegate, verified: true },
    expected: { allowed: true, reason: "sender_allowed", rule: "allow" },
  },
  {
    name: "extreme postage value (soroban i128 max) satisfies policy",
    policy: { ...basePolicy, allowUnknown: true, requireVerified: false, minimumPostage: "1000000" },
    senderRule: null,
    input: { postage: "170141183460469231731687303715884105727", sender, verified: true },
    expected: { allowed: true, reason: "policy_satisfied", source: "configured", rule: "default" },
  },
];

describe("policy evaluation decision vectors (service level)", () => {
  for (const vector of policyServiceVectors) {
    it(`branch: ${vector.name}`, async () => {
      const repository = new MemoryApiRepository();
      if (vector.policy !== null) {
        await repository.setPolicy(owner, vector.policy);
      }
      if (vector.senderRule !== null) {
        await repository.setSenderRule(owner, vector.input.sender, vector.senderRule);
      }

      const result = await evaluateMailboxPolicy(repository, {
        owner,
        postage: vector.input.postage,
        sender: vector.input.sender,
        verified: vector.input.verified,
      });

      // Branch mismatch diagnostics
      if (result.allowed !== vector.expected.allowed || result.reason !== vector.expected.reason) {
        throw new Error(
          `Decision branch mismatch for '${vector.name}': ` +
            `expected decision allowed=${vector.expected.allowed}, reason='${vector.expected.reason}'; ` +
            `received allowed=${result.allowed}, reason='${result.reason}'`,
        );
      }

      expect(result.allowed).toBe(vector.expected.allowed);
      expect(result.reason).toBe(vector.expected.reason);

      if (vector.expected.source !== undefined) {
        expect(result.source).toBe(vector.expected.source);
      }
      if (vector.expected.rule !== undefined) {
        expect(result.rule).toBe(vector.expected.rule);
      }
    });
  }

  it("covers all known reason codes across vector suite", () => {
    const reasons = new Set(policyServiceVectors.map((v) => v.expected.reason));
    expect(reasons).toEqual(
      new Set([
        "sender_allowed",
        "sender_blocked",
        "unknown_senders_disabled",
        "verification_required",
        "insufficient_postage",
        "policy_satisfied",
      ]),
    );
  });
});
