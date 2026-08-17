import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import { evaluateMailboxPolicy } from "../../../src/server/api/policy-service";
import {
  distinctAddressPairArbitrary,
  mailboxPolicyArbitrary,
  senderRuleArbitrary,
  stroopAmountArbitrary,
} from "./arbitraries";

const NUM_RUNS = 150;

const KNOWN_REASONS = [
  "sender_allowed",
  "sender_blocked",
  "unknown_senders_disabled",
  "verification_required",
  "insufficient_postage",
  "policy_satisfied",
] as const;

describe("evaluateMailboxPolicy (property)", () => {
  it("always resolves to one of the six known reasons, consistent with `allowed`", async () => {
    await fc.assert(
      fc.asyncProperty(
        distinctAddressPairArbitrary,
        mailboxPolicyArbitrary,
        senderRuleArbitrary,
        stroopAmountArbitrary,
        fc.boolean(),
        async ([owner, sender], policy, rule, postage, verified) => {
          const repository = new MemoryApiRepository();
          await repository.setPolicy(owner, policy);
          if (rule !== "default") await repository.setSenderRule(owner, sender, rule);

          const result = await evaluateMailboxPolicy(repository, {
            owner,
            postage,
            sender,
            verified,
          });

          expect(KNOWN_REASONS).toContain(result.reason);
          expect(result.allowed).toBe(
            result.reason === "sender_allowed" || result.reason === "policy_satisfied",
          );
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("an explicit allow rule always short-circuits, regardless of policy, postage, or verification", async () => {
    await fc.assert(
      fc.asyncProperty(
        distinctAddressPairArbitrary,
        mailboxPolicyArbitrary,
        stroopAmountArbitrary,
        fc.boolean(),
        async ([owner, sender], policy, postage, verified) => {
          const repository = new MemoryApiRepository();
          await repository.setPolicy(owner, policy);
          await repository.setSenderRule(owner, sender, "allow");

          const result = await evaluateMailboxPolicy(repository, {
            owner,
            postage,
            sender,
            verified,
          });

          expect(result).toMatchObject({ allowed: true, reason: "sender_allowed" });
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("an explicit block rule always rejects, regardless of policy, postage, or verification", async () => {
    await fc.assert(
      fc.asyncProperty(
        distinctAddressPairArbitrary,
        mailboxPolicyArbitrary,
        stroopAmountArbitrary,
        fc.boolean(),
        async ([owner, sender], policy, postage, verified) => {
          const repository = new MemoryApiRepository();
          await repository.setPolicy(owner, policy);
          await repository.setSenderRule(owner, sender, "block");

          const result = await evaluateMailboxPolicy(repository, {
            owner,
            postage,
            sender,
            verified,
          });

          expect(result).toMatchObject({ allowed: false, reason: "sender_blocked" });
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("the default-rule decision matches allowUnknown/requireVerified/minimumPostage exactly", async () => {
    await fc.assert(
      fc.asyncProperty(
        distinctAddressPairArbitrary,
        mailboxPolicyArbitrary,
        stroopAmountArbitrary,
        fc.boolean(),
        async ([owner, sender], policy, postage, verified) => {
          const repository = new MemoryApiRepository();
          await repository.setPolicy(owner, policy);
          // Sender rule left at its "default" fallback (never explicitly set).

          const result = await evaluateMailboxPolicy(repository, {
            owner,
            postage,
            sender,
            verified,
          });

          let expectedReason: (typeof KNOWN_REASONS)[number];
          if (!policy.allowUnknown) {
            expectedReason = "unknown_senders_disabled";
          } else if (policy.requireVerified && !verified) {
            expectedReason = "verification_required";
          } else if (BigInt(postage) < BigInt(policy.minimumPostage)) {
            expectedReason = "insufficient_postage";
          } else {
            expectedReason = "policy_satisfied";
          }

          expect(result.reason).toBe(expectedReason);
          expect(result.allowed).toBe(expectedReason === "policy_satisfied");
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
