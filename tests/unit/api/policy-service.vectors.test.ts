import { describe, expect, it } from "vitest";

import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import { evaluateMailboxPolicy } from "../../../src/server/api/policy-service";
import type { MailboxPolicy } from "../../../src/server/api/domain";

// Table-driven vectors for every decision branch of evaluateMailboxPolicy.
// Each vector asserts the exact decision AND reason code so a regression
// identifies the mismatched branch. Reusable by protocol/integration tests.
interface PolicyVector {
  name: string;
  policy: MailboxPolicy;
  senderRule: "allow" | "block" | null;
  input: { postage: string; sender: string; verified: boolean };
  expected: { allowed: boolean; reason: string };
}

const owner = `G${"A".repeat(55)}`;
const sender = `G${"B".repeat(55)}`;

function makeRepo(policy: MailboxPolicy, senderRule: "allow" | "block" | null) {
  const repository = new MemoryApiRepository();
  // seed policy via the service contract
  return repository;
}

const basePolicy: MailboxPolicy = {
  allowUnknown: false,
  minimumPostage: "0",
  requireVerified: true,
};

const vectors: PolicyVector[] = [
  {
    name: "sender allow override short-circuits",
    policy: basePolicy,
    senderRule: "allow",
    input: { postage: "0", sender, verified: false },
    expected: { allowed: true, reason: "sender_allowed" },
  },
  {
    name: "sender block override short-circuits",
    policy: basePolicy,
    senderRule: "block",
    input: { postage: "0", sender, verified: false },
    expected: { allowed: false, reason: "sender_blocked" },
  },
  {
    name: "unknown sender disabled (allowUnknown=false)",
    policy: { ...basePolicy, allowUnknown: false },
    senderRule: null,
    input: { postage: "0", sender, verified: false },
    expected: { allowed: false, reason: "unknown_senders_disabled" },
  },
  {
    name: "verification required when unverified",
    policy: { ...basePolicy, allowUnknown: true, requireVerified: true },
    senderRule: null,
    input: { postage: "1000", sender, verified: false },
    expected: { allowed: false, reason: "verification_required" },
  },
  {
    name: "insufficient postage below minimum",
    policy: { ...basePolicy, allowUnknown: true, requireVerified: false, minimumPostage: "500" },
    senderRule: null,
    input: { postage: "100", sender, verified: true },
    expected: { allowed: false, reason: "insufficient_postage" },
  },
  {
    name: "policy satisfied (allow, verified, enough postage)",
    policy: { ...basePolicy, allowUnknown: true, requireVerified: true, minimumPostage: "500" },
    senderRule: null,
    input: { postage: "1000", sender, verified: true },
    expected: { allowed: true, reason: "policy_satisfied" },
  },
  {
    name: "default policy (no stored config) blocks unknown unverified",
    policy: basePolicy,
    senderRule: null,
    input: { postage: "0", sender, verified: false },
    expected: { allowed: false, reason: "unknown_senders_disabled" },
  },
];

describe("policy evaluation decision vectors", () => {
  for (const vector of vectors) {
    it(`branch: ${vector.name}`, async () => {
      const repository = makeRepo(vector.policy, vector.senderRule);
      await repository.setPolicy(owner, vector.policy);
      if (vector.senderRule) {
        await repository.setSenderRule(owner, sender, vector.senderRule);
      }

      const result = await evaluateMailboxPolicy(repository, {
        owner,
        postage: vector.input.postage,
        sender: vector.input.sender,
        verified: vector.input.verified,
      });

      expect(result.allowed).toBe(vector.expected.allowed);
      expect(result.reason).toBe(vector.expected.reason);
    });
  }

  it("covers all known reason codes", () => {
    const reasons = new Set(vectors.map((v) => v.expected.reason));
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
