import { describe, expect, it } from "vitest";

import {
  evaluateAdmissionDecision,
  selectAdmissionSnapshot,
  toAdmissionEvidence,
  type AdmissionPolicySnapshot,
} from "../../../src/server/api/policy-admission";
import type { ChainMailboxPolicy, SenderRule } from "../../../src/server/api/domain";
import vectors from "../../../protocol/vectors/vectors.json";

const { owner: _owner, sender: _sender, cases } = vectors.categories.relay_admission;

describe("relay_admission vectors", () => {
  for (const c of cases) {
    it(c.id, () => {
      const policy = c.setup.policy as ChainMailboxPolicy;
      const chainPolicy = (c.setup.chainPolicy as ChainMailboxPolicy | undefined) ?? policy;
      const offchain: AdmissionPolicySnapshot = {
        policy,
        version: c.setup.offchainVersion,
        rule: c.setup.senderRule as SenderRule,
        tier: null,
      };
      const chain: AdmissionPolicySnapshot = {
        policy: chainPolicy,
        version: c.setup.chainVersion,
        rule: c.setup.senderRule as SenderRule,
        tier: null,
      };
      const { snapshot, source } = selectAdmissionSnapshot({ offchain, chain });
      const decision = evaluateAdmissionDecision(snapshot, c.input);
      const evidence = toAdmissionEvidence(
        decision,
        snapshot.policy,
        source,
        "2026-08-19T21:00:00.000Z",
      );

      expect(evidence.allowed, `${c.id}: allowed`).toBe(c.expected.allowed);
      expect(evidence.disposition, `${c.id}: disposition`).toBe(c.expected.disposition);
      expect(evidence.reason, `${c.id}: reason`).toBe(c.expected.reason);
      expect(evidence.source, `${c.id}: source`).toBe(c.expected.source);
    });
  }

  it("covers every sender-facing disposition and stale-chain fallback", () => {
    const dispositions = new Set(cases.map((c) => c.expected.disposition));
    expect(dispositions).toEqual(new Set(["trusted", "request", "verified", "priced", "blocked"]));
    expect(cases.some((c) => c.expected.source === "stale_chain_fallback")).toBe(true);
  });
});
