import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import {
  distinctAddressPairArbitrary,
  mailboxPolicyArbitrary,
  postageArbitrary,
  senderRuleArbitrary,
} from "./arbitraries";

const NUM_RUNS = 100;

const pendingPostageArbitrary = postageArbitrary.map((postage) => ({
  ...postage,
  status: "pending" as const,
}));

describe("MemoryApiRepository policy storage (property)", () => {
  it("round-trips every generated policy exactly", async () => {
    await fc.assert(
      fc.asyncProperty(
        distinctAddressPairArbitrary,
        mailboxPolicyArbitrary,
        async ([owner], policy) => {
          const repository = new MemoryApiRepository();
          await repository.setPolicy(owner, policy);
          await expect(repository.getPolicy(owner)).resolves.toEqual(policy);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("isolates stored policy from later mutation of the caller's object", async () => {
    await fc.assert(
      fc.asyncProperty(
        distinctAddressPairArbitrary,
        mailboxPolicyArbitrary,
        async ([owner], policy) => {
          const repository = new MemoryApiRepository();
          const mutable = { ...policy };
          await repository.setPolicy(owner, mutable);

          mutable.allowUnknown = !mutable.allowUnknown;
          mutable.requireVerified = !mutable.requireVerified;
          mutable.minimumPostage = "999999999";

          await expect(repository.getPolicy(owner)).resolves.toEqual(policy);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

describe("MemoryApiRepository sender rules (property)", () => {
  it("round-trips every generated sender rule, isolated per owner/sender pair", async () => {
    await fc.assert(
      fc.asyncProperty(
        distinctAddressPairArbitrary,
        senderRuleArbitrary,
        async ([owner, sender], rule) => {
          const repository = new MemoryApiRepository();
          await expect(repository.getSenderRule(owner, sender)).resolves.toBe("default");

          await repository.setSenderRule(owner, sender, rule);
          await expect(repository.getSenderRule(owner, sender)).resolves.toBe(rule);

          await repository.setSenderRule(owner, sender, "default");
          await expect(repository.getSenderRule(owner, sender)).resolves.toBe("default");
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

describe("MemoryApiRepository postage storage (property)", () => {
  it("round-trips every generated postage record exactly", async () => {
    await fc.assert(
      fc.asyncProperty(postageArbitrary, async (postage) => {
        const repository = new MemoryApiRepository();
        await repository.setPostage(postage);
        await expect(repository.getPostage(postage.messageId)).resolves.toEqual(postage);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("transitionPostage under concurrency: exactly one caller wins per messageId", async () => {
    await fc.assert(
      fc.asyncProperty(
        pendingPostageArbitrary,
        fc.integer({ min: 2, max: 10 }),
        async (postage, concurrency) => {
          const repository = new MemoryApiRepository();
          await repository.setPostage(postage);

          const results = await Promise.all(
            Array.from({ length: concurrency }, () =>
              repository.transitionPostage(postage.messageId, "pending", "settled"),
            ),
          );

          const applied = results.filter((result) => result.outcome === "applied");
          const conflicted = results.filter((result) => result.outcome === "conflict");
          expect(applied).toHaveLength(1);
          expect(conflicted).toHaveLength(concurrency - 1);
        },
      ),
      { numRuns: 30 },
    );
  });
});
