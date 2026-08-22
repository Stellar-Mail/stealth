import { describe, expect, it, vi } from "vitest";

import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import {
  confirmPolicyWrite,
  evaluateMailboxPolicy,
  policyDecisionKind,
  schedulePolicyWrite,
  setMailboxPolicy,
  setSenderRule,
} from "../../../src/server/api/policy-service";
import {
  createRelayAdmissionEvaluator,
  toSafeAdmissionDecision,
  type ChainPolicyDecision,
  type PolicyChainClient,
  type RelayAdmissionInput,
} from "../../../src/services/relay/policy-admission";

const owner = `G${"A".repeat(55)}`;
const sender = `G${"B".repeat(55)}`;

function input(overrides: Partial<RelayAdmissionInput> = {}): RelayAdmissionInput {
  return {
    owner,
    sender,
    postage: "0",
    verified: false,
    receipt: false,
    ...overrides,
  };
}

function chainDecision(overrides: Partial<ChainPolicyDecision> = {}): ChainPolicyDecision {
  return {
    allowed: true,
    reason: "sender_allowed",
    requiredPostage: "0",
    rule: "allow",
    version: 3,
    ...overrides,
  };
}

describe("policyDecisionKind", () => {
  it("maps every reason onto a sender-actionable class", () => {
    expect(policyDecisionKind("sender_allowed")).toBe("trusted");
    expect(policyDecisionKind("sender_blocked")).toBe("blocked");
    expect(policyDecisionKind("unknown_senders_disabled")).toBe("blocked");
    expect(policyDecisionKind("verification_required")).toBe("verified");
    expect(policyDecisionKind("receipt_required")).toBe("verified");
    expect(policyDecisionKind("insufficient_postage")).toBe("priced");
    expect(policyDecisionKind("tier_satisfied")).toBe("priced");
    expect(policyDecisionKind("policy_satisfied", "0")).toBe("request");
    expect(policyDecisionKind("policy_satisfied", "100")).toBe("priced");
  });
});

describe("evaluateMailboxPolicy admission extras", () => {
  it("records policy version 0 before any write intent exists", async () => {
    const repository = new MemoryApiRepository();
    const result = await evaluateMailboxPolicy(repository, {
      owner,
      sender,
      postage: "0",
      verified: true,
    });
    expect(result.policyVersion).toBe(0);
    expect(result.kind).toBe("blocked");
  });

  it("pins the off-chain write-intent version on the decision", async () => {
    const repository = new MemoryApiRepository();
    await setMailboxPolicy(repository, owner, {
      allowUnknown: true,
      requireVerified: false,
      minimumPostage: "0",
    });
    const result = await evaluateMailboxPolicy(repository, {
      owner,
      sender,
      postage: "0",
      verified: false,
    });
    expect(result.policyVersion).toBe(1);
    expect(result.kind).toBe("request");
    expect(result.reason).toBe("policy_satisfied");
  });

  it("rejects when a scheduled policy requires a receipt that is absent", async () => {
    const repository = new MemoryApiRepository();
    await setMailboxPolicy(
      repository,
      owner,
      { allowUnknown: true, requireVerified: false, minimumPostage: "0" },
      { requireReceipt: true },
    );
    const result = await evaluateMailboxPolicy(repository, {
      owner,
      sender,
      postage: "0",
      verified: true,
      receipt: false,
    });
    expect(result).toMatchObject({
      allowed: false,
      reason: "receipt_required",
      kind: "verified",
    });
  });

  it("evaluates a sender tier after identity checks", async () => {
    const repository = new MemoryApiRepository();
    await setMailboxPolicy(repository, owner, {
      allowUnknown: true,
      requireVerified: false,
      minimumPostage: "1000",
    });
    await expect(
      evaluateMailboxPolicy(repository, {
        owner,
        sender,
        postage: "25",
        verified: true,
        senderTier: "25",
      }),
    ).resolves.toMatchObject({ allowed: true, reason: "tier_satisfied", kind: "priced" });
    await expect(
      evaluateMailboxPolicy(repository, {
        owner,
        sender,
        postage: "24",
        verified: true,
        senderTier: "25",
      }),
    ).resolves.toMatchObject({ allowed: false, reason: "insufficient_postage", kind: "priced" });
  });
});

describe("createRelayAdmissionEvaluator", () => {
  it("prefers a live chain decision and records source=chain", async () => {
    const repository = new MemoryApiRepository();
    const chain: PolicyChainClient = {
      evaluate: async () => chainDecision({ version: 4, reason: "policy_satisfied" }),
    };
    const evaluator = createRelayAdmissionEvaluator({ repository, chain });
    const evidence = await evaluator.evaluate(input({ postage: "10", verified: true }));

    expect(evidence.source).toBe("chain");
    expect(evidence.policyVersion).toBe(4);
    expect(evidence.kind).toBe("request");
    expect(toSafeAdmissionDecision(evidence)).toEqual({
      allowed: true,
      kind: "request",
      reason: "policy_satisfied",
      policyVersion: 4,
      requiredPostage: "0",
    });
  });

  it("falls back off-chain when the chain client throws", async () => {
    const repository = new MemoryApiRepository();
    await setSenderRule(repository, owner, sender, "block");
    const chain: PolicyChainClient = {
      evaluate: async () => {
        throw new Error("rpc unavailable");
      },
    };
    const evaluator = createRelayAdmissionEvaluator({ repository, chain });
    const evidence = await evaluator.evaluate(input());

    expect(evidence.source).toBe("offchain_fallback");
    expect(evidence.kind).toBe("blocked");
    expect(evidence.reason).toBe("sender_blocked");
  });

  it("falls back off-chain when the chain times out", async () => {
    vi.useFakeTimers();
    try {
      const repository = new MemoryApiRepository();
      await setSenderRule(repository, owner, sender, "allow");
      const chain: PolicyChainClient = {
        evaluate: () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve(
                chainDecision({
                  allowed: false,
                  reason: "sender_blocked",
                  rule: "block",
                  version: 1,
                }),
              );
            }, 100);
          }),
      };
      const evaluator = createRelayAdmissionEvaluator({
        repository,
        chain,
        chainTimeoutMs: 10,
      });
      const pending = evaluator.evaluate(input());
      await vi.advanceTimersByTimeAsync(10);
      const evidence = await pending;

      expect(evidence.source).toBe("offchain_fallback");
      expect(evidence.kind).toBe("trusted");
    } finally {
      vi.useRealTimers();
    }
  });

  it("falls back off-chain for a malformed chain payload", async () => {
    const repository = new MemoryApiRepository();
    await setMailboxPolicy(repository, owner, {
      allowUnknown: true,
      requireVerified: false,
      minimumPostage: "0",
    });
    const chain = {
      evaluate: async () =>
        ({
          allowed: true,
          reason: "not-a-reason",
          requiredPostage: "0",
          rule: "default",
          version: 1,
        }) as unknown as ChainPolicyDecision,
    };
    const evaluator = createRelayAdmissionEvaluator({ repository, chain });
    const evidence = await evaluator.evaluate(input({ verified: true }));

    expect(evidence.source).toBe("offchain_fallback");
    expect(evidence.reason).toBe("policy_satisfied");
  });

  it("treats a chain version behind a confirmed off-chain write as stale", async () => {
    const repository = new MemoryApiRepository();
    await setMailboxPolicy(repository, owner, {
      allowUnknown: true,
      requireVerified: false,
      minimumPostage: "0",
    });
    await confirmPolicyWrite(repository, owner, "tx-redacted");

    const chain: PolicyChainClient = {
      evaluate: async () =>
        chainDecision({
          allowed: false,
          reason: "unknown_senders_disabled",
          rule: "default",
          version: 0,
        }),
    };
    const evaluator = createRelayAdmissionEvaluator({ repository, chain });
    const evidence = await evaluator.evaluate(input({ verified: true }));

    expect(evidence.source).toBe("offchain_fallback");
    expect(evidence.policyVersion).toBe(1);
    expect(evidence.allowed).toBe(true);
    expect(evidence.kind).toBe("request");
  });

  it("does not treat a pending write as stale — live chain remains authoritative", async () => {
    const repository = new MemoryApiRepository();
    await schedulePolicyWrite(repository, owner, {
      allowUnknown: true,
      requireVerified: false,
      requireReceipt: false,
      minimumPostage: "0",
    });
    const chain: PolicyChainClient = {
      evaluate: async () =>
        chainDecision({
          allowed: false,
          reason: "unknown_senders_disabled",
          rule: "default",
          version: 0,
        }),
    };
    const evaluator = createRelayAdmissionEvaluator({ repository, chain });
    const evidence = await evaluator.evaluate(input());

    expect(evidence.source).toBe("chain");
    expect(evidence.kind).toBe("blocked");
    expect(evidence.policyVersion).toBe(0);
  });

  it("covers every off-chain decision branch used by relay admission", async () => {
    const cases: Array<{
      name: string;
      setup: (repo: MemoryApiRepository) => Promise<void>;
      input: RelayAdmissionInput;
      kind: string;
      reason: string;
      allowed: boolean;
    }> = [
      {
        name: "trusted",
        setup: (repo) => setSenderRule(repo, owner, sender, "allow").then(() => undefined),
        input: input(),
        kind: "trusted",
        reason: "sender_allowed",
        allowed: true,
      },
      {
        name: "blocked",
        setup: (repo) => setSenderRule(repo, owner, sender, "block").then(() => undefined),
        input: input(),
        kind: "blocked",
        reason: "sender_blocked",
        allowed: false,
      },
      {
        name: "request",
        setup: (repo) =>
          setMailboxPolicy(repo, owner, {
            allowUnknown: true,
            requireVerified: false,
            minimumPostage: "0",
          }).then(() => undefined),
        input: input({ verified: true }),
        kind: "request",
        reason: "policy_satisfied",
        allowed: true,
      },
      {
        name: "verified",
        setup: (repo) =>
          setMailboxPolicy(repo, owner, {
            allowUnknown: true,
            requireVerified: true,
            minimumPostage: "0",
          }).then(() => undefined),
        input: input({ verified: false, postage: "0" }),
        kind: "verified",
        reason: "verification_required",
        allowed: false,
      },
      {
        name: "priced",
        setup: (repo) =>
          setMailboxPolicy(repo, owner, {
            allowUnknown: true,
            requireVerified: false,
            minimumPostage: "500",
          }).then(() => undefined),
        input: input({ postage: "100", verified: true }),
        kind: "priced",
        reason: "insufficient_postage",
        allowed: false,
      },
      {
        name: "priced-allowed",
        setup: (repo) =>
          setMailboxPolicy(repo, owner, {
            allowUnknown: true,
            requireVerified: false,
            minimumPostage: "500",
          }).then(() => undefined),
        input: input({ postage: "500", verified: true }),
        kind: "priced",
        reason: "policy_satisfied",
        allowed: true,
      },
      {
        name: "unknown-disabled",
        setup: async () => undefined,
        input: input(),
        kind: "blocked",
        reason: "unknown_senders_disabled",
        allowed: false,
      },
      {
        name: "receipt-required",
        setup: (repo) =>
          setMailboxPolicy(
            repo,
            owner,
            { allowUnknown: true, requireVerified: false, minimumPostage: "0" },
            { requireReceipt: true },
          ).then(() => undefined),
        input: input({ verified: true, receipt: false }),
        kind: "verified",
        reason: "receipt_required",
        allowed: false,
      },
    ];

    for (const vector of cases) {
      const repository = new MemoryApiRepository();
      await vector.setup(repository);
      const evaluator = createRelayAdmissionEvaluator({ repository });
      const evidence = await evaluator.evaluate(vector.input);
      expect(evidence.kind, vector.name).toBe(vector.kind);
      expect(evidence.reason, vector.name).toBe(vector.reason);
      expect(evidence.allowed, vector.name).toBe(vector.allowed);
      expect(evidence.source, vector.name).toBe("offchain_fallback");
    }
  });
});
