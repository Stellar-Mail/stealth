import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import {
  assertReceiptParticipant,
  createDeliveryReceipt,
  markReceiptRead,
} from "../../../src/server/api/receipt-service";
import {
  distinctAddressPairArbitrary,
  hash32Arbitrary,
  instantMsArbitrary,
  stellarAddressArbitrary,
} from "./arbitraries";

const NUM_RUNS = 60;

describe("createDeliveryReceipt (property)", () => {
  it("is idempotent: replays the first delivery receipt regardless of a later `now`", async () => {
    await fc.assert(
      fc.asyncProperty(
        hash32Arbitrary,
        distinctAddressPairArbitrary,
        instantMsArbitrary,
        instantMsArbitrary,
        async (messageId, [recipient, sender], nowAMs, nowBMs) => {
          const repository = new MemoryApiRepository();
          const input = { messageId, recipient, sender };

          const first = await createDeliveryReceipt(repository, input, new Date(nowAMs));
          const second = await createDeliveryReceipt(repository, input, new Date(nowBMs));

          expect(second).toEqual(first);
          expect(first.deliveredAt).toBe(new Date(nowAMs).toISOString());
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("rejects a second delivery receipt for the same messageId with different participants", async () => {
    await fc.assert(
      fc.asyncProperty(
        hash32Arbitrary,
        distinctAddressPairArbitrary,
        distinctAddressPairArbitrary,
        instantMsArbitrary,
        async (messageId, [recipientA, senderA], [recipientB, senderB], nowMs) => {
          fc.pre(recipientA !== recipientB || senderA !== senderB);
          const repository = new MemoryApiRepository();
          await createDeliveryReceipt(
            repository,
            { messageId, recipient: recipientA, sender: senderA },
            new Date(nowMs),
          );

          await expect(
            createDeliveryReceipt(
              repository,
              { messageId, recipient: recipientB, sender: senderB },
              new Date(nowMs),
            ),
          ).rejects.toMatchObject({ status: 409 });
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("survives N concurrent duplicate deliveries, all resolving to one winning timestamp", async () => {
    await fc.assert(
      fc.asyncProperty(
        hash32Arbitrary,
        distinctAddressPairArbitrary,
        instantMsArbitrary,
        fc.integer({ min: 2, max: 8 }),
        async (messageId, [recipient, sender], nowMs, concurrency) => {
          const repository = new MemoryApiRepository();
          const input = { messageId, recipient, sender };

          const results = await Promise.all(
            Array.from({ length: concurrency }, (_, i) =>
              createDeliveryReceipt(repository, input, new Date(nowMs + i)),
            ),
          );

          const distinctDeliveredAt = new Set(results.map((receipt) => receipt.deliveredAt));
          expect(distinctDeliveredAt.size).toBe(1);
        },
      ),
      { numRuns: 20 },
    );
  });
});

describe("assertReceiptParticipant (property)", () => {
  it("accepts both participants and rejects any other generated address", () => {
    fc.assert(
      fc.property(
        hash32Arbitrary,
        distinctAddressPairArbitrary,
        stellarAddressArbitrary,
        (messageId, [recipient, sender], other) => {
          fc.pre(other !== recipient && other !== sender);
          const receipt = {
            deliveredAt: new Date().toISOString(),
            messageId,
            readAt: null,
            recipient,
            sender,
          };

          expect(() => assertReceiptParticipant(receipt, recipient)).not.toThrow();
          expect(() => assertReceiptParticipant(receipt, sender)).not.toThrow();
          expect(() => assertReceiptParticipant(receipt, other)).toThrowError(
            expect.objectContaining({ status: 403 }),
          );
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

describe("markReceiptRead (property)", () => {
  it("records the read timestamp once; later calls with a different `now` replay the first", async () => {
    await fc.assert(
      fc.asyncProperty(
        hash32Arbitrary,
        distinctAddressPairArbitrary,
        instantMsArbitrary,
        instantMsArbitrary,
        instantMsArbitrary,
        async (messageId, [recipient, sender], deliveredMs, readAMs, readBMs) => {
          const repository = new MemoryApiRepository();
          await createDeliveryReceipt(
            repository,
            { messageId, recipient, sender },
            new Date(deliveredMs),
          );

          const first = await markReceiptRead(repository, messageId, recipient, new Date(readAMs));
          const second = await markReceiptRead(repository, messageId, recipient, new Date(readBMs));

          expect(second.readAt).toBe(first.readAt);
          expect(first.readAt).toBe(new Date(readAMs).toISOString());
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
