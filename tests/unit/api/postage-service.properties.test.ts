import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { createApiContext } from "../../../src/server/api/context";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import { submitPostage } from "../../../src/server/api/postage-service";
import { distinctAddressPairArbitrary, hash32Arbitrary, I128_MAX } from "./arbitraries";

const NUM_RUNS = 60;
const NOW = new Date("2026-06-14T12:00:00.000Z");

/** A (minimumPostage, amount) pair with amount strictly below the minimum. */
const belowMinimumArbitrary = fc.bigInt({ min: 1n, max: I128_MAX }).chain((minimumPostage) =>
  fc.record({
    minimumPostage: fc.constant(minimumPostage),
    amount: fc.bigInt({ min: 0n, max: minimumPostage - 1n }),
  }),
);

/** A (minimumPostage, amount) pair with amount at or above the minimum. */
const atOrAboveMinimumArbitrary = fc.bigInt({ min: 0n, max: I128_MAX }).chain((minimumPostage) =>
  fc.record({
    minimumPostage: fc.constant(minimumPostage),
    amount: fc.bigInt({ min: minimumPostage, max: I128_MAX }),
  }),
);

describe("submitPostage (property)", () => {
  it("always rejects an amount strictly below the mailbox minimum with 422", async () => {
    await fc.assert(
      fc.asyncProperty(
        distinctAddressPairArbitrary,
        hash32Arbitrary,
        hash32Arbitrary,
        belowMinimumArbitrary,
        async ([recipient, sender], messageId, paymentHash, { minimumPostage, amount }) => {
          const repository = new MemoryApiRepository();
          await repository.setPolicy(recipient, {
            allowUnknown: true,
            minimumPostage: minimumPostage.toString(),
            requireVerified: false,
          });

          await expect(
            submitPostage(
              createApiContext(repository),
              {
                amount: amount.toString(),
                messageId,
                paymentHash,
                recipient,
                sender,
              },
              NOW,
            ),
          ).rejects.toMatchObject({ status: 422 });
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("always accepts an amount at or above the mailbox minimum, recording it as pending", async () => {
    await fc.assert(
      fc.asyncProperty(
        distinctAddressPairArbitrary,
        hash32Arbitrary,
        hash32Arbitrary,
        atOrAboveMinimumArbitrary,
        async ([recipient, sender], messageId, paymentHash, { minimumPostage, amount }) => {
          const repository = new MemoryApiRepository();
          await repository.setPolicy(recipient, {
            allowUnknown: true,
            minimumPostage: minimumPostage.toString(),
            requireVerified: false,
          });

          const result = await submitPostage(
            createApiContext(repository),
            {
              amount: amount.toString(),
              messageId,
              paymentHash,
              recipient,
              sender,
            },
            NOW,
          );

          expect(result).toMatchObject({
            amount: amount.toString(),
            createdAt: NOW.toISOString(),
            status: "pending",
          });
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("rejects any resubmission under the same messageId as a 409 conflict, regardless of the new payload", async () => {
    await fc.assert(
      fc.asyncProperty(
        distinctAddressPairArbitrary,
        hash32Arbitrary,
        hash32Arbitrary,
        hash32Arbitrary,
        fc.bigInt({ min: 0n, max: I128_MAX }),
        fc.bigInt({ min: 0n, max: I128_MAX }),
        async ([recipient, sender], messageId, paymentHashA, paymentHashB, amountA, amountB) => {
          const repository = new MemoryApiRepository();
          await repository.setPolicy(recipient, {
            allowUnknown: true,
            minimumPostage: "0",
            requireVerified: false,
          });
          const context = createApiContext(repository);

          await submitPostage(
            context,
            {
              amount: amountA.toString(),
              messageId,
              paymentHash: paymentHashA,
              recipient,
              sender,
            },
            NOW,
          );

          await expect(
            submitPostage(
              context,
              {
                amount: amountB.toString(),
                messageId,
                paymentHash: paymentHashB,
                recipient,
                sender,
              },
              NOW,
            ),
          ).rejects.toMatchObject({ status: 409 });
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
