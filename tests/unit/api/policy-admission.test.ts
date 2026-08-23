import { describe, expect, it } from "vitest";

import {
  admissionDisposition,
  defaultAdmissionPolicy,
  evaluateAdmissionDecision,
  selectAdmissionSnapshot,
  toAdmissionEvidence,
  toAdmissionPolicy,
  type AdmissionPolicySnapshot,
} from "../../../src/server/api/policy-admission";
import type { ChainMailboxPolicy } from "../../../src/server/api/domain";

const requestPolicy: ChainMailboxPolicy = {
  allowUnknown: true,
  requireVerified: false,
  requireReceipt: false,
  minimumPostage: "0",
};

const verifiedPolicy: ChainMailboxPolicy = {
  allowUnknown: true,
  requireVerified: true,
  requireReceipt: false,
  minimumPostage: "0",
};

const pricedPolicy: ChainMailboxPolicy = {
  allowUnknown: true,
  requireVerified: false,
  requireReceipt: false,
  minimumPostage: "500",
};

function snapshot(overrides: Partial<AdmissionPolicySnapshot> = {}): AdmissionPolicySnapshot {
  return {
    policy: requestPolicy,
    version: 1,
    rule: "default",
    tier: null,
    ...overrides,
  };
}

describe("evaluateAdmissionDecision (contract-faithful)", () => {
  it("trusted: explicit allow bypasses verification and postage", () => {
    const decision = evaluateAdmissionDecision(
      snapshot({ rule: "allow", policy: verifiedPolicy }),
      {
        postage: "0",
        verified: false,
        receipt: false,
      },
    );
    expect(decision).toMatchObject({
      allowed: true,
      reason: "sender_allowed",
      requiredPostage: "0",
    });
    expect(admissionDisposition(decision, verifiedPolicy)).toBe("trusted");
  });

  it("blocked: explicit block always denies", () => {
    const decision = evaluateAdmissionDecision(snapshot({ rule: "block", policy: pricedPolicy }), {
      postage: "999999",
      verified: true,
      receipt: true,
    });
    expect(decision).toMatchObject({ allowed: false, reason: "sender_blocked" });
    expect(admissionDisposition(decision, pricedPolicy)).toBe("blocked");
  });

  it("request: unknown sender admitted under allowUnknown", () => {
    const decision = evaluateAdmissionDecision(snapshot(), {
      postage: "0",
      verified: false,
      receipt: false,
    });
    expect(decision).toMatchObject({ allowed: true, reason: "policy_satisfied" });
    expect(admissionDisposition(decision, requestPolicy)).toBe("request");
  });

  it("verified: unverified sender is denied when requireVerified", () => {
    const decision = evaluateAdmissionDecision(snapshot({ policy: verifiedPolicy }), {
      postage: "0",
      verified: false,
      receipt: false,
    });
    expect(decision).toMatchObject({ allowed: false, reason: "verification_required" });
    expect(admissionDisposition(decision, verifiedPolicy)).toBe("verified");
  });

  it("verified: verified sender is admitted as verified when min postage is 0", () => {
    const decision = evaluateAdmissionDecision(snapshot({ policy: verifiedPolicy }), {
      postage: "0",
      verified: true,
      receipt: false,
    });
    expect(decision).toMatchObject({ allowed: true, reason: "policy_satisfied" });
    expect(admissionDisposition(decision, verifiedPolicy)).toBe("verified");
  });

  it("priced: insufficient postage is denied", () => {
    const decision = evaluateAdmissionDecision(snapshot({ policy: pricedPolicy }), {
      postage: "499",
      verified: false,
      receipt: false,
    });
    expect(decision).toMatchObject({
      allowed: false,
      reason: "insufficient_postage",
      requiredPostage: "500",
    });
    expect(admissionDisposition(decision, pricedPolicy)).toBe("priced");
  });

  it("priced: meeting the mailbox minimum admits as priced", () => {
    const decision = evaluateAdmissionDecision(snapshot({ policy: pricedPolicy }), {
      postage: "500",
      verified: false,
      receipt: false,
    });
    expect(decision).toMatchObject({ allowed: true, reason: "policy_satisfied" });
    expect(admissionDisposition(decision, pricedPolicy)).toBe("priced");
  });

  it("blocked: unknown senders disabled", () => {
    const policy = defaultAdmissionPolicy();
    const decision = evaluateAdmissionDecision(snapshot({ policy, version: 0 }), {
      postage: "0",
      verified: true,
      receipt: false,
    });
    expect(decision).toMatchObject({ allowed: false, reason: "unknown_senders_disabled" });
    expect(admissionDisposition(decision, policy)).toBe("blocked");
  });

  it("receipt required denies when receipt is absent", () => {
    const policy: ChainMailboxPolicy = { ...requestPolicy, requireReceipt: true };
    const decision = evaluateAdmissionDecision(snapshot({ policy }), {
      postage: "0",
      verified: false,
      receipt: false,
    });
    expect(decision).toMatchObject({ allowed: false, reason: "receipt_required" });
  });

  it("sender tier overrides mailbox minimum after verification", () => {
    const decision = evaluateAdmissionDecision(snapshot({ policy: verifiedPolicy, tier: "1000" }), {
      postage: "1000",
      verified: true,
      receipt: false,
    });
    expect(decision).toMatchObject({
      allowed: true,
      reason: "tier_satisfied",
      requiredPostage: "1000",
    });
    expect(admissionDisposition(decision, verifiedPolicy)).toBe("priced");
  });

  it("malformed postage is treated as zero", () => {
    const decision = evaluateAdmissionDecision(snapshot({ policy: pricedPolicy }), {
      postage: "not-a-number",
      verified: false,
      receipt: false,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("insufficient_postage");
  });

  it("boundary: zero postage meets a zero minimum", () => {
    const decision = evaluateAdmissionDecision(snapshot(), {
      postage: "0",
      verified: false,
      receipt: false,
    });
    expect(decision.allowed).toBe(true);
  });

  it("boundary: i128 max postage satisfies a priced policy", () => {
    const decision = evaluateAdmissionDecision(snapshot({ policy: pricedPolicy }), {
      postage: "170141183460469231731687303715884105727",
      verified: false,
      receipt: false,
    });
    expect(decision.allowed).toBe(true);
  });
});

describe("selectAdmissionSnapshot (stale-chain fallback)", () => {
  it("uses chain when chain version is at least the off-chain version", () => {
    const offchain = snapshot({ version: 1, policy: requestPolicy });
    const chain = snapshot({ version: 1, policy: pricedPolicy });
    const selected = selectAdmissionSnapshot({ offchain, chain });
    expect(selected.source).toBe("chain");
    expect(selected.snapshot.policy.minimumPostage).toBe("500");
  });

  it("falls back to off-chain when the chain version is stale", () => {
    const offchain = snapshot({ version: 3, policy: pricedPolicy });
    const chain = snapshot({ version: 1, policy: requestPolicy });
    const selected = selectAdmissionSnapshot({ offchain, chain });
    expect(selected.source).toBe("stale_chain_fallback");
    expect(selected.snapshot.policy.minimumPostage).toBe("500");
  });

  it("uses off-chain when the chain is unavailable", () => {
    const offchain = snapshot({ version: 2 });
    const selected = selectAdmissionSnapshot({ offchain, chain: null });
    expect(selected.source).toBe("offchain");
    expect(selected.snapshot.version).toBe(2);
  });
});

describe("toAdmissionEvidence", () => {
  it("snapshots version, disposition, and source without payload fields", () => {
    const decision = evaluateAdmissionDecision(snapshot({ rule: "allow" }), {
      postage: "0",
      verified: false,
      receipt: false,
    });
    const evidence = toAdmissionEvidence(
      decision,
      requestPolicy,
      "chain",
      "2026-08-19T21:00:00.000Z",
    );
    expect(evidence).toEqual({
      allowed: true,
      disposition: "trusted",
      reason: "sender_allowed",
      rule: "allow",
      policyVersion: 1,
      requiredPostage: "0",
      source: "chain",
      evaluatedAt: "2026-08-19T21:00:00.000Z",
    });
    expect(JSON.stringify(evidence)).not.toContain("payload");
    expect(JSON.stringify(evidence)).not.toContain("secret");
  });

  it("maps three-field API policy onto the on-chain shape", () => {
    expect(
      toAdmissionPolicy({ allowUnknown: true, requireVerified: false, minimumPostage: "1" }),
    ).toEqual({
      allowUnknown: true,
      requireVerified: false,
      requireReceipt: false,
      minimumPostage: "1",
    });
  });
});
