import { describe, expect, it } from "vitest";

import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import {
  assertReceiptParticipant,
  createDeliveryReceipt,
  getReceipt,
  markReceiptRead,
} from "../../../src/server/api/receipt-service";

const recipient = `G${"A".repeat(55)}`;
const sender = `G${"B".repeat(55)}`;
const messageId = "a".repeat(64);

describe("receipt service", () => {
  it("creates one sender-authored delivery receipt", async () => {
    const repository = new MemoryApiRepository();
    const input = { messageId, recipient, sender };
    const expectedReceipt = {
      deliveredAt: "2026-06-14T12:00:00.000Z",
      messageId,
      readAt: null,
      recipient,
      sender,
    };

    await expect(
      createDeliveryReceipt(repository, input, new Date("2026-06-14T12:00:00.000Z")),
    ).resolves.toEqual(expectedReceipt);

    await expect(
      createDeliveryReceipt(repository, input, new Date("2026-06-14T12:05:00.000Z")),
    ).resolves.toEqual(expectedReceipt);
  });

  it("rejects duplicate delivery receipts with conflicting participants", async () => {
    const repository = new MemoryApiRepository();
    await createDeliveryReceipt(repository, { messageId, recipient, sender });

    await expect(
      createDeliveryReceipt(repository, {
        messageId,
        recipient: `G${"C".repeat(55)}`,
        sender,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("returns receipts only to message participants", async () => {
    const repository = new MemoryApiRepository();
    const receipt = await createDeliveryReceipt(repository, { messageId, recipient, sender });

    await expect(getReceipt(repository, messageId)).resolves.toEqual(receipt);
    expect(() => assertReceiptParticipant(receipt, recipient)).not.toThrow();
    expect(() => assertReceiptParticipant(receipt, `G${"C".repeat(55)}`)).toThrowError(
      expect.objectContaining({ status: 403 }),
    );
  });

  it("records the recipient read timestamp once and replays read duplicates", async () => {
    const repository = new MemoryApiRepository();
    await createDeliveryReceipt(repository, { messageId, recipient, sender });
    const expectedReadAt = "2026-06-14T12:30:00.000Z";

    await expect(
      markReceiptRead(repository, messageId, recipient, new Date(expectedReadAt)),
    ).resolves.toMatchObject({ readAt: expectedReadAt });
    await expect(
      markReceiptRead(repository, messageId, recipient, new Date("2026-06-14T12:45:00.000Z")),
    ).resolves.toMatchObject({ readAt: expectedReadAt });
  });

  it("serializes concurrent duplicate delivery receipts with first timestamp precedence", async () => {
    const repository = new MemoryApiRepository();
    const input = { messageId, recipient, sender };
    const expectedReceipt = {
      deliveredAt: "2026-06-14T12:00:00.000Z",
      messageId,
      readAt: null,
      recipient,
      sender,
    };

    await expect(
      Promise.all([
        createDeliveryReceipt(repository, input, new Date("2026-06-14T12:00:00.000Z")),
        createDeliveryReceipt(repository, input, new Date("2026-06-14T12:05:00.000Z")),
      ]),
    ).resolves.toEqual([expectedReceipt, expectedReceipt]);
    await expect(getReceipt(repository, messageId)).resolves.toEqual(expectedReceipt);
  });

  it("serializes concurrent duplicate read receipts with first timestamp precedence", async () => {
    const repository = new MemoryApiRepository();
    await createDeliveryReceipt(repository, { messageId, recipient, sender });

    const [first, second] = await Promise.all([
      markReceiptRead(repository, messageId, recipient, new Date("2026-06-14T12:30:00.000Z")),
      markReceiptRead(repository, messageId, recipient, new Date("2026-06-14T12:45:00.000Z")),
    ]);

    expect(first).toEqual(second);
    expect(first).toMatchObject({ readAt: "2026-06-14T12:30:00.000Z" });
    await expect(getReceipt(repository, messageId)).resolves.toMatchObject({
      readAt: "2026-06-14T12:30:00.000Z",
    });
  });

  it("throws 404 when getting a non-existent receipt", async () => {
    const repository = new MemoryApiRepository();
    await expect(getReceipt(repository, "nonexistent")).rejects.toMatchObject({ status: 404 });
  });

  it("throws 404 when marking read on a non-existent receipt", async () => {
    const repository = new MemoryApiRepository();
    await expect(markReceiptRead(repository, "nonexistent", recipient)).rejects.toMatchObject({
      status: 404,
    });
  });
});
